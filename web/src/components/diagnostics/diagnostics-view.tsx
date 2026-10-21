"use client";

import * as React from "react";
import { Check, LoaderCircle, X } from "lucide-react";
import { browserDiag } from "@/lib/engine/browser";
import { ENGINE_MODE, MODEL_ID, MODEL_REVISION, MODEL_SOURCE } from "@/lib/engine/config";
import { Card, PageHeader, PrimaryButton } from "@/components/ui/primitives";

type Parity = { eos: number; vocab: number; samples: { text: string; ids: number[]; next: [string, number][] }[] };
type Result = Awaited<ReturnType<typeof browserDiag>>;

const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const parityUrl = () =>
  MODEL_SOURCE === "local" ? `/models/${MODEL_ID}/parity.json` : `https://huggingface.co/${MODEL_ID}/resolve/${MODEL_REVISION}/parity.json`;

function Mark({ ok }: { ok: boolean }) {
  return ok ? <Check className="h-4 w-4 text-success" aria-label="match" /> : <X className="h-4 w-4 text-danger" aria-label="mismatch" />;
}

export function DiagnosticsView() {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [data, setData] = React.useState<{ parity: Parity; result: Result; loadMs: number } | null>(null);

  async function run() {
    setBusy(true);
    setError("");
    try {
      const parity = (await (await fetch(parityUrl(), { cache: "no-store" })).json()) as Parity;
      const t0 = performance.now();
      const result = await browserDiag(parity.samples.map((s) => s.text));
      setData({ parity, result, loadMs: Math.round(performance.now() - t0) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The check failed.");
    } finally {
      setBusy(false);
    }
  }

  const tokensOk = data ? data.result.rows.every((r, i) => same(r.ids, data.parity.samples[i].ids)) : false;
  const eosOk = data ? data.result.eos === data.parity.eos : false;
  const vocabOk = data ? data.result.vocab === data.parity.vocab : false;

  return (
    <div>
      <PageHeader title="Model check">
        Runs the model in this browser and compares it with what the original PyTorch model produced when it was exported. Open this once after you publish the ONNX package.
      </PageHeader>
      {ENGINE_MODE !== "browser" ? (
        <Card className="text-sm text-muted">This build uses a model server, so there is nothing to check here.</Card>
      ) : (
        <>
          <p className="mb-4 text-xs text-muted">Model: {MODEL_ID} @ {MODEL_REVISION} ({MODEL_SOURCE})</p>
          <PrimaryButton onClick={run} disabled={busy}>
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {busy ? "Checking, this loads the model first" : "Run the check"}
          </PrimaryButton>
          {error && <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm">{error}</p>}
          {data && (
            <div className="mt-6 flex flex-col gap-4">
              <Card>
                <ul className="flex flex-col gap-2 text-sm">
                  <li className="flex items-center gap-2"><Mark ok={tokensOk} /> Tokenizer gives the same token ids as the original on all {data.parity.samples.length} sample prompts</li>
                  <li className="flex items-center gap-2"><Mark ok={eosOk} /> End token id is {data.result.eos} (expected {data.parity.eos})</li>
                  <li className="flex items-center gap-2"><Mark ok={vocabOk} /> Vocabulary size is {data.result.vocab} (expected {data.parity.vocab})</li>
                  <li className="text-muted">Load plus all next word checks took {(data.loadMs / 1000).toFixed(1)} s.</li>
                </ul>
              </Card>
              <div className="overflow-x-auto rounded-2xl border border-border bg-surface/90">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr><th className="p-3">Prompt</th><th className="p-3">Ids</th><th className="p-3">Next words here (int8)</th><th className="p-3">Original (fp32)</th><th className="p-3">ms</th></tr>
                  </thead>
                  <tbody>
                    {data.result.rows.map((r, i) => (
                      <tr key={r.text} className="border-t border-border align-top">
                        <td className="p-3">{r.text}</td>
                        <td className="p-3"><Mark ok={same(r.ids, data.parity.samples[i].ids)} /></td>
                        <td className="p-3">{r.next.map((n) => n.word).join(", ")}</td>
                        <td className="p-3 text-muted">{data.parity.samples[i].next.map((n) => n[0]).join(", ")}</td>
                        <td className="p-3 text-muted">{r.ms}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted">The two word lists should mostly agree. Small differences are normal after int8 compression. Any red cross on the token ids means the browser reads text differently from the original model, and that must be fixed before launch.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
