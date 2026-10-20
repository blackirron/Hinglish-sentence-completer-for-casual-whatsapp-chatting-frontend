"use client";

import Link from "next/link";
import * as React from "react";
import { ArrowLeft, Check, Copy, Lightbulb, LoaderCircle, Pencil, Plus, RefreshCw, Star, Zap } from "lucide-react";
import { ApiError, complete, type Suggestion } from "@/lib/api";
import { CREATIVITY_VALUES, LENGTH_VALUES, type Creativity, type Length } from "@/lib/limits";
import { entriesStore, recordEntry, resultStore, settingsStore, toggleSaved, useStore } from "@/lib/storage";
import { seconds } from "@/lib/format";
import { copyText } from "@/lib/text";
import { splitSuggestion, tagsFor } from "@/lib/tags";
import { Card, GhostButton, IconButton, PageHeader, PrimaryButton } from "@/components/ui/primitives";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useNotice } from "@/components/ui/notice";
import { cn } from "@/lib/utils";

const MAX_SHOWN = 12;
const LABEL: Record<string, string> = { safe: "Safe", balanced: "Balanced", playful: "Playful", short: "Short", medium: "Medium", long: "Long" };
const STEPS = ["Write", "Set options", "Complete", "Copy and use"];

type Busy = "more" | "tone" | "shorter" | "longer" | "again" | null;

function Stepper() {
  return (
    <ol className="mb-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs font-medium" aria-label="Progress">
      {STEPS.map((label, i) => {
        const done = i < 2;
        const current = i === 2;
        return (
          <li key={label} className="flex items-center gap-3" aria-current={current ? "step" : undefined}>
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px]",
                  current ? "border-primary bg-primary text-primary-foreground" : done ? "border-primary text-primary" : "border-border text-muted",
                )}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={current ? "text-foreground" : "text-muted"}>{label}</span>
            </span>
            {i < STEPS.length - 1 && <span aria-hidden className="hidden h-px w-8 bg-border sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}

function mergeUnique(a: Suggestion[], b: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const s of [...a, ...b]) {
    const key = s.text.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out.slice(0, MAX_SHOWN);
}

export function ResultsView() {
  const result = useStore(resultStore);
  const settings = useStore(settingsStore);
  const entries = useStore(entriesStore);
  const { show, node } = useNotice();
  const [busy, setBusy] = React.useState<Busy>(null);
  const [error, setError] = React.useState<unknown>(null);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [edited, setEdited] = React.useState<Record<string, string>>({});
  const ctrlRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => () => ctrlRef.current?.abort(), []);

  if (!result) {
    return (
      <div>
        <PageHeader title="Nothing to show yet">Write the start of a message and press Complete sentence. Your latest suggestions will appear here.</PageHeader>
        <Link href="/" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
          <ArrowLeft className="h-4 w-4" /> Go to Home
        </Link>
      </div>
    );
  }

  const current = result;
  const savedKeys = new Set(entries.filter((e) => e.saved).map((e) => e.input + "\u0000" + e.output));
  const lengthIdx = LENGTH_VALUES.indexOf(current.length);

  async function regenerate(kind: Exclude<Busy, null>, opts: { creativity: Creativity; length: Length; append?: boolean }) {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setBusy(kind);
    setError(null);
    try {
      const res = await complete(
        { prompt: current.input, n: settings.suggestions, length: opts.length, creativity: opts.creativity },
        ctrl.signal,
      );
      const next = opts.append ? mergeUnique(current.suggestions, res.suggestions) : mergeUnique([], res.suggestions);
      resultStore.set({ ...current, suggestions: next, latencyMs: res.latency_ms, creativity: opts.creativity, length: opts.length, createdAt: Date.now() });
      if (!opts.append) {
        setEdited({});
        setEditing(null);
      }
    } catch (err) {
      if (!(err instanceof DOMException)) setError(err);
    } finally {
      if (!ctrl.signal.aborted) setBusy(null);
    }
  }

  const textOf = (s: Suggestion) => edited[s.text] ?? s.text;

  async function chooseIt(s: Suggestion) {
    const text = textOf(s).trim();
    if (!text) return;
    const ok = await copyText(text);
    recordEntry(current.input, text);
    show(ok ? "Copied. Paste it in your chat." : "Saved to history. Copy it manually.");
  }

  async function copyOnly(s: Suggestion) {
    show((await copyText(textOf(s).trim())) ? "Copied" : "Could not copy");
  }

  function nextTone(): Creativity {
    return CREATIVITY_VALUES[(CREATIVITY_VALUES.indexOf(current.creativity) + 1) % CREATIVITY_VALUES.length];
  }

  const disabled = busy !== null;

  return (
    <div>
      <Stepper />
      <PageHeader
        title="Here are your completions"
        action={
          <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-primary hover:text-primary">
            <Plus className="h-4 w-4" /> New input
          </Link>
        }
      >
        Pick a suggestion, edit it, or generate more.
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-4">
          <Card className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your input</p>
              <p className="mt-1 break-words text-sm">{current.input}</p>
            </div>
            <Link href="/" aria-label="Edit your input" title="Edit your input" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:border-primary hover:text-primary">
              <Pencil className="h-4 w-4" />
            </Link>
          </Card>

          {error != null && <ErrorBanner error={error} onRetry={error instanceof ApiError && error.code === "rate_limited" ? undefined : () => regenerate("again", { creativity: current.creativity, length: current.length })} />}

          <ul className="flex flex-col gap-3" aria-live="polite" aria-busy={busy !== null}>
            {current.suggestions.map((s, i) => {
              const text = textOf(s);
              const { head, tail } = splitSuggestion(current.input, text);
              const isEditing = editing === s.text;
              const saved = savedKeys.has(current.input + "\u0000" + text.trim());
              return (
                <li key={s.text} className="rise-in">
                  <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-soft text-xs font-bold text-soft-foreground">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <textarea
                          autoFocus
                          aria-label={`Edit suggestion ${i + 1}`}
                          value={text}
                          maxLength={600}
                          rows={3}
                          onChange={(e) => setEdited((prev) => ({ ...prev, [s.text]: e.target.value }))}
                          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      ) : (
                        <p className="break-words text-sm leading-relaxed">
                          <span className="text-muted">{head}</span>
                          <span className="font-semibold">{tail}</span>
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {tagsFor(text).map((t) => (
                          <span key={t} className="rounded-full bg-soft px-2.5 py-0.5 text-[11px] font-medium text-soft-foreground">{t}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <IconButton label={isEditing ? "Done editing" : "Edit this suggestion"} onClick={() => setEditing(isEditing ? null : s.text)}>
                        {isEditing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                      </IconButton>
                      <IconButton label="Copy" onClick={() => copyOnly(s)}><Copy className="h-4 w-4" /></IconButton>
                      <IconButton
                        label={saved ? "Remove from My phrases" : "Save to My phrases"}
                        aria-pressed={saved}
                        onClick={() => { toggleSaved(current.input, text.trim()); show(saved ? "Removed from My phrases" : "Saved to My phrases"); }}
                        className={saved ? "border-primary text-primary" : undefined}
                      >
                        <Star className={cn("h-4 w-4", saved && "fill-current")} />
                      </IconButton>
                      <PrimaryButton onClick={() => chooseIt(s)} className="px-4 py-2">Use this</PrimaryButton>
                    </div>
                  </Card>
                </li>
              );
            })}
            {busy !== null && <li className="skeleton h-20 rounded-2xl" aria-hidden />}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <PrimaryButton disabled={disabled || current.suggestions.length >= MAX_SHOWN} onClick={() => regenerate("more", { creativity: current.creativity, length: current.length, append: true })}>
              {busy === "more" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Generate more
            </PrimaryButton>
            <GhostButton disabled={disabled} onClick={() => regenerate("tone", { creativity: nextTone(), length: current.length })} title="Cycles Safe, Balanced, Playful">
              Change style: {LABEL[nextTone()]}
            </GhostButton>
            <GhostButton disabled={disabled || lengthIdx <= 0} onClick={() => regenerate("shorter", { creativity: current.creativity, length: LENGTH_VALUES[lengthIdx - 1] })}>Shorter</GhostButton>
            <GhostButton disabled={disabled || lengthIdx >= LENGTH_VALUES.length - 1} onClick={() => regenerate("longer", { creativity: current.creativity, length: LENGTH_VALUES[lengthIdx + 1] })}>Longer</GhostButton>
            <IconButton label="Try again with the same settings" disabled={disabled} onClick={() => regenerate("again", { creativity: current.creativity, length: current.length })}>
              <RefreshCw className={cn("h-4 w-4", busy === "again" && "animate-spin")} />
            </IconButton>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="text-sm font-bold">Settings used</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-soft px-3 py-1 text-xs font-medium text-soft-foreground">{LABEL[current.creativity]}</span>
              <span className="rounded-full bg-soft px-3 py-1 text-xs font-medium text-soft-foreground">{LABEL[current.length]}</span>
              <span className="rounded-full bg-soft px-3 py-1 text-xs font-medium text-soft-foreground">Hinglish</span>
            </div>
            <p className="mt-4 text-sm font-semibold">{current.suggestions.length} suggestion{current.suggestions.length === 1 ? "" : "s"}</p>
            <p className="text-xs text-muted">Last batch took {seconds(current.latencyMs)}</p>
          </Card>
          <Card className="bg-soft/60">
            <div className="flex items-start gap-3">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <h2 className="text-sm font-bold">Pro tip</h2>
                <p className="mt-1 text-sm text-muted">Edit any suggestion before you copy it. The model is a small one, so treat each line as a draft, not a final answer.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
      {node}
    </div>
  );
}
