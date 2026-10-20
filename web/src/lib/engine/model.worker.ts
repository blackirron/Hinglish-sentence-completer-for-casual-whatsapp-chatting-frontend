/// <reference lib="webworker" />
import { AutoModelForCausalLM, AutoTokenizer, StoppingCriteria, StoppingCriteriaList, Tensor, env } from "@huggingface/transformers";
import { BLOCKLIST, MODEL_ID, MODEL_REVISION, MODEL_SOURCE } from "./config";
import type { Request, Response } from "./protocol";
import { rankNextWords } from "./rank";
import { containsBlocked, cutAfterSentences, hasSentenceEnd, joinText, splitFragment } from "./text";

const TEMPERATURE = { safe: 0.6, balanced: 0.8, playful: 1.0 } as const;
const post = (r: Response) => (self as unknown as Worker).postMessage(r);

// Everything runs from files we host, nothing is fetched from a CDN. See next.config.ts for the CSP.
env.backends.onnx.wasm!.wasmPaths = { mjs: "/ort/ort-wasm-simd-threaded.mjs", wasm: "/ort/ort-wasm-simd-threaded.wasm" };
env.backends.onnx.wasm!.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)) : 1;
env.useWasmCache = false;
if (MODEL_SOURCE === "local") {
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.localModelPath = "/models/";
} else {
  env.allowLocalModels = false;
}

type Tok = Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>;
type Mdl = Awaited<ReturnType<typeof AutoModelForCausalLM.from_pretrained>>;
let tok: Tok;
let model: Mdl;
let eos = 0;
let special = new Set<number>();
let endIds = new Set<number>();
let loading: Promise<void> | null = null;

const cancelled = new Set<number>();
let latestNext = 0;
let chain: Promise<void> = Promise.resolve();

function load(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    post({ type: "state", state: "loading", progress: 0 });
    const files = new Map<string, { loaded: number; total: number }>();
    const progress_callback = (e: { status?: string; file?: string; loaded?: number; total?: number }) => {
      if (e.status !== "progress" || !e.file || !e.total) return;
      files.set(e.file, { loaded: e.loaded ?? 0, total: e.total });
      let loaded = 0;
      let total = 0;
      for (const f of files.values()) {
        loaded += f.loaded;
        total += f.total;
      }
      post({ type: "state", state: "loading", progress: total ? Math.min(0.99, loaded / total) : 0 });
    };
    tok = await AutoTokenizer.from_pretrained(MODEL_ID, { revision: MODEL_REVISION, progress_callback });
    model = await AutoModelForCausalLM.from_pretrained(MODEL_ID, { revision: MODEL_REVISION, dtype: "q8", device: "wasm", progress_callback });

    const fromTok = tok.convert_tokens_to_ids("[EOS]");
    const fromCfg = Number((model as unknown as { config: { eos_token_id?: number } }).config.eos_token_id);
    eos = Number.isInteger(fromTok) && fromTok >= 0 ? fromTok : fromCfg;
    if (!Number.isInteger(eos) || eos < 0) throw new Error("The model has no usable end token.");
    special = new Set<number>(tok.all_special_ids);
    special.add(eos);
    endIds = new Set<number>();
    for (const [token, id] of tok.get_vocab()) if (hasSentenceEnd(token)) endIds.add(id);
    // Warm up so the first real request is not the slow one.
    await run(() => generate("kal main", 1, 1, 6, "balanced", -1));
    post({ type: "state", state: "ready" });
  })().catch((err) => {
    loading = null;
    post({ type: "state", state: "error", message: err instanceof Error ? err.message : "The model could not be loaded." });
    throw err;
  });
  return loading;
}

const run = <T,>(job: () => Promise<T>): Promise<T> => job();

function encode(text: string): number[] {
  const ids = text ? (tok.encode(text, { add_special_tokens: false }) as number[]) : [];
  return ids.length ? ids : [eos];
}

const int64 = (values: number[][]) => {
  const rows = values.length;
  const cols = values[0].length;
  const data = new BigInt64Array(rows * cols);
  values.forEach((row, r) => row.forEach((v, c) => (data[r * cols + c] = BigInt(v))));
  return new Tensor("int64", data, [rows, cols]);
};
const ones = (rows: number, cols: number) => new Tensor("int64", new BigInt64Array(rows * cols).fill(BigInt(1)), [rows, cols]);

async function rank(prompt: string, k: number) {
  const { context, fragment } = splitFragment(prompt);
  const ids = encode(context);
  const out = (await model({ input_ids: int64([ids]), attention_mask: ones(1, ids.length) })) as { logits: Tensor };
  const vocab = out.logits.dims[2];
  const data = out.logits.data as Float32Array;
  const last = data.subarray((ids.length - 1) * vocab, ids.length * vocab);
  const candidates = rankNextWords(last, { k, fragment, decode: (i) => tok.decode([i]), special, blocklist: BLOCKLIST });
  return { ids, candidates };
}

async function diagnose(id: number, prompts: string[]) {
  const rows = [];
  for (const text of prompts) {
    const t0 = performance.now();
    const { ids, candidates } = await rank(text.trimEnd() + " ", 5); // trailing space: the whole text is context, like the reference
    rows.push({ text, ids: text ? (tok.encode(text, { add_special_tokens: false }) as number[]) : ids, next: candidates, ms: Math.round(performance.now() - t0) });
  }
  post({ type: "diag", id, eos, vocab: tok.get_vocab().size, rows });
}

async function nextWords(id: number, prompt: string, k: number) {
  const t0 = performance.now();
  const { candidates } = await rank(prompt, k);
  post({ type: "next", id, candidates, ms: Math.round(performance.now() - t0) });
}

async function generate(prompt: string, n: number, sentences: number, maxNew: number, creativity: keyof typeof TEMPERATURE, jobId: number) {
  const ids = encode(prompt);
  const start = ids.length;

  class StopAfter extends StoppingCriteria {
    _call(input_ids: number[][]): boolean[] {
      return input_ids.map((row) => {
        if (cancelled.has(jobId)) return true;
        let ends = 0;
        for (let i = start; i < row.length; i++) if (endIds.has(Number(row[i]))) ends += 1;
        return ends >= sentences;
      });
    }
  }
  const criteria = new StoppingCriteriaList();
  criteria.push(new StopAfter());

  const batch = Array.from({ length: n }, () => ids);
  const out = (await model.generate({
    inputs: int64(batch),
    attention_mask: ones(n, start),
    do_sample: true,
    top_k: 50,
    top_p: 0.95,
    temperature: TEMPERATURE[creativity] ?? 0.8,
    repetition_penalty: 1.2,
    no_repeat_ngram_size: 2,
    max_new_tokens: maxNew,
    eos_token_id: eos,
    pad_token_id: eos,
    stopping_criteria: criteria,
  })) as Tensor;

  const total = out.dims[1];
  const flat = Array.from(out.data as ArrayLike<number | bigint>, Number);
  const seen = new Set<string>();
  const results: { text: string; continuation: string }[] = [];
  for (let r = 0; r < n; r++) {
    const row = flat.slice(r * total + start, (r + 1) * total);
    const decoded = tok.decode(row, { skip_special_tokens: true, clean_up_tokenization_spaces: true });
    const continuation = cutAfterSentences(decoded, sentences).trim();
    const key = continuation.toLowerCase();
    if (!continuation || seen.has(key) || containsBlocked(continuation, BLOCKLIST)) continue;
    seen.add(key);
    results.push({ text: joinText(prompt, continuation), continuation });
  }
  return results;
}

async function complete(m: Extract<Request, { type: "complete" }>) {
  const t0 = performance.now();
  const suggestions = await generate(m.prompt, m.n, m.sentences, m.maxNew, m.creativity, m.id);
  if (cancelled.delete(m.id)) return post({ type: "stale", id: m.id });
  if (!suggestions.length) return post({ type: "fail", id: m.id, code: "no_result", message: "The model had nothing to add. Try a longer start." });
  post({ type: "complete", id: m.id, suggestions, ms: Math.round(performance.now() - t0) });
}

self.onmessage = (e: MessageEvent<Request>) => {
  const m = e.data;
  if (m.type === "cancel") {
    cancelled.add(m.id);
    return;
  }
  if (m.type === "next") latestNext = m.id;
  chain = chain
    .then(async () => {
      if (m.type === "load") return load();
      await load();
      if (m.type === "diag") return diagnose(m.id, m.prompts);
      if (m.type === "next") {
        if (m.id !== latestNext) return post({ type: "stale", id: m.id });
        return nextWords(m.id, m.prompt, m.k);
      }
      if (cancelled.delete(m.id)) return post({ type: "stale", id: m.id });
      cancelled.delete(m.id);
      return complete(m);
    })
    .catch((err) => {
      if (m.type === "load") return;
      post({ type: "fail", id: m.id, code: "engine_error", message: err instanceof Error ? err.message : "Something went wrong in the model." });
    });
};
