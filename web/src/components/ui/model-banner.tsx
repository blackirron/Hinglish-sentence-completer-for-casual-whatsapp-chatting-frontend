"use client";

import * as React from "react";
import { Download, LoaderCircle, TriangleAlert } from "lucide-react";
import { APPROX_DOWNLOAD_MB, ENGINE_MODE } from "@/lib/engine/config";
import { engineStore, startEngine } from "@/lib/engine/browser";
import { PrimaryButton } from "@/components/ui/primitives";

/** Explains the one time model download and shows its progress. Hidden once the model is ready. */
export function ModelBanner() {
  const s = React.useSyncExternalStore(engineStore.subscribe, engineStore.get, engineStore.getServer);
  if (ENGINE_MODE !== "browser" || s.state === "ready") return null;

  if (s.state === "idle") {
    return (
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-soft/60 px-4 py-3 text-sm">
        <Download className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          The model runs on your device, so your text never leaves it. The first visit downloads about {APPROX_DOWNLOAD_MB} MB, then it is saved in your browser.
        </span>
        <PrimaryButton onClick={startEngine} className="px-4 py-2">Load model</PrimaryButton>
      </div>
    );
  }
  if (s.state === "loading") {
    const pct = Math.round(s.progress * 100);
    return (
      <div className="mb-5 rounded-2xl border border-border bg-soft/60 px-4 py-3 text-sm" role="status" aria-live="polite">
        <div className="flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
          <span className="font-medium">Loading the model, {pct}%</span>
          <span className="text-muted">First time only, it is cached afterwards.</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }
  return (
    <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm">
      <TriangleAlert className="h-4 w-4 shrink-0 text-danger" />
      <span className="min-w-0 flex-1">{s.message ?? "The model could not be loaded."}</span>
      {s.state === "error" && <PrimaryButton onClick={startEngine} className="px-4 py-2">Try again</PrimaryButton>}
    </div>
  );
}
