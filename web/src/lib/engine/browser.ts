import { ApiError } from "@/lib/api-error";
import type { EngineState, Request, Response } from "./protocol";
import type { Creativity } from "@/lib/limits";

export type EngineStatus = { state: EngineState; progress: number; message?: string };

const listeners = new Set<() => void>();
let status: EngineStatus = { state: "idle", progress: 0 };
const SERVER_STATUS: EngineStatus = { state: "idle", progress: 0 };

function setStatus(next: EngineStatus) {
  status = next;
  listeners.forEach((l) => l());
}

export const engineStore = {
  get: () => status,
  getServer: () => SERVER_STATUS,
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

type Pending = { resolve: (r: Response) => void; reject: (e: unknown) => void };
let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

const aborted = () => new DOMException("Request replaced", "AbortError");

function supported(): boolean {
  return typeof Worker !== "undefined" && typeof WebAssembly === "object";
}

function boot(): Worker | null {
  if (worker) return worker;
  if (!supported()) {
    setStatus({ state: "unsupported", progress: 0, message: "This browser cannot run the model. Try a recent Chrome, Edge, Firefox or Safari." });
    return null;
  }
  const w = new Worker(new URL("./model.worker.ts", import.meta.url), { type: "module" });
  w.onmessage = (e: MessageEvent<Response>) => {
    const m = e.data;
    if (m.type === "state") {
      setStatus({ state: m.state, progress: m.state === "ready" ? 1 : m.progress ?? status.progress, message: m.message });
      if (m.state === "error") {
        for (const [, p] of pending) p.reject(new ApiError("model_load_failed", m.message ?? "The model could not be loaded.", 0));
        pending.clear();
        w.terminate();
        worker = null;
      }
      return;
    }
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.type === "stale") p.reject(aborted());
    else if (m.type === "fail") p.reject(new ApiError(m.code, m.message, m.code === "no_result" ? 422 : 500));
    else p.resolve(m);
  };
  w.onerror = () => {
    setStatus({ state: "error", progress: 0, message: "The model worker stopped. Reload the page and try again." });
    for (const [, p] of pending) p.reject(new ApiError("engine_error", "The model worker stopped.", 0));
    pending.clear();
    worker = null;
  };
  worker = w;
  return w;
}

/** Start downloading and loading the model. Safe to call many times. */
export function startEngine() {
  if (status.state === "ready" || status.state === "loading" || status.state === "unsupported") return;
  const w = boot();
  if (!w) return;
  setStatus({ state: "loading", progress: 0 });
  w.postMessage({ type: "load" } satisfies Request);
}

function ask<T extends Response>(build: (id: number) => Request, signal?: AbortSignal): Promise<T> {
  startEngine();
  const w = boot();
  if (!w) return Promise.reject(new ApiError("unsupported", status.message ?? "This browser cannot run the model.", 0));
  if (signal?.aborted) return Promise.reject(aborted());
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (r: Response) => void, reject });
    signal?.addEventListener(
      "abort",
      () => {
        if (!pending.delete(id)) return;
        w.postMessage({ type: "cancel", id } satisfies Request);
        reject(aborted());
      },
      { once: true },
    );
    w.postMessage(build(id));
  });
}

export async function browserNext(prompt: string, k: number, signal?: AbortSignal) {
  const r = await ask<Extract<Response, { type: "next" }>>((id) => ({ type: "next", id, prompt, k }), signal);
  return { candidates: r.candidates, latency_ms: r.ms };
}

export async function browserComplete(
  o: { prompt: string; n: number; sentences: number; maxNew: number; creativity: Creativity },
  signal?: AbortSignal,
) {
  const r = await ask<Extract<Response, { type: "complete" }>>((id) => ({ type: "complete", id, ...o }), signal);
  return { suggestions: r.suggestions, latency_ms: r.ms };
}

export async function browserDiag(prompts: string[]) {
  const r = await ask<Extract<Response, { type: "diag" }>>((id) => ({ type: "diag", id, prompts }));
  return { eos: r.eos, vocab: r.vocab, rows: r.rows };
}

/** True on connections where a 100 MB download should wait for a click. */
export function isMetered(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (c.saveData === true || ["slow-2g", "2g", "3g"].includes(c.effectiveType ?? ""));
}
