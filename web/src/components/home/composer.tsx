"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { ArrowRight, FileText, Lightbulb, LoaderCircle, SlidersHorizontal, Type, Languages } from "lucide-react";
import { complete, predictNext, type Candidate } from "@/lib/api";
import { LENGTH_VALUES, CREATIVITY_VALUES, MAX_PROMPT_CHARS } from "@/lib/limits";
import { draftStore, resultStore, settingsStore, useStore } from "@/lib/storage";
import { applyWord } from "@/lib/text";
import { Card, Chip, GhostButton, PrimaryButton, Switch } from "@/components/ui/primitives";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ModelBanner } from "@/components/ui/model-banner";
import { ENGINE_MODE } from "@/lib/engine/config";
import { isMetered, startEngine } from "@/lib/engine/browser";

const LABEL = { safe: "Safe", balanced: "Balanced", playful: "Playful", short: "Short", medium: "Medium", long: "Long" } as const;

export function Composer() {
  const router = useRouter();
  const text = useStore(draftStore);
  const settings = useStore(settingsStore);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);
  const [chips, setChips] = React.useState<Candidate[]>([]);
  const [chipsLoading, setChipsLoading] = React.useState(false);
  const runRef = React.useRef<AbortController | null>(null);

  // Live next word suggestions, debounced, with the previous request cancelled.
  React.useEffect(() => {
    if (!settings.nextWord || !text.trim()) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setChipsLoading(true);
      try {
        const res = await predictNext(text, 5, ctrl.signal);
        setChips(res.candidates);
      } catch (err) {
        if (!(err instanceof DOMException)) setChips([]);
      } finally {
        if (!ctrl.signal.aborted) setChipsLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [text, settings.nextWord]);

  const visibleChips = settings.nextWord && text.trim() ? chips : [];
  const tooLong = text.length > MAX_PROMPT_CHARS;
  const canRun = !!text.trim() && !tooLong && !loading;

  async function run() {
    if (!canRun) return;
    runRef.current?.abort();
    const ctrl = new AbortController();
    runRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const prompt = text.trim();
      const res = await complete(
        { prompt, n: settings.suggestions, length: settings.length, creativity: settings.creativity },
        ctrl.signal,
      );
      resultStore.set({
        input: prompt,
        suggestions: res.suggestions,
        latencyMs: res.latency_ms,
        creativity: settings.creativity,
        length: settings.length,
        createdAt: Date.now(),
      });
      router.push("/results");
    } catch (err) {
      if (!(err instanceof DOMException)) setError(err);
      setLoading(false);
    }
  }

  return (
    <div>
    <ModelBanner />
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <Card className="p-5 sm:p-6">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="message" className="inline-flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-primary" />
            Your message
          </label>
          <span className={tooLong ? "text-xs font-medium text-danger" : "text-xs text-muted"} aria-live="polite">
            {text.length} / {MAX_PROMPT_CHARS} characters
          </span>
        </div>
        <textarea
          id="message"
          value={text}
          onChange={(e) => draftStore.set(e.target.value)}
          onFocus={() => { if (ENGINE_MODE === "browser" && !isMetered()) startEngine(); }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              run();
            }
          }}
          rows={4}
          placeholder="Kal ka plan pakka hai na, bas mujhe..."
          spellCheck={false}
          autoCapitalize="sentences"
          className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-base leading-relaxed outline-none placeholder:text-muted/70 focus-visible:ring-2 focus-visible:ring-ring"
        />

        <div className="mt-3 flex min-h-9 flex-wrap items-center gap-2" aria-live="polite">
          {settings.nextWord && (
            <>
              <span className="text-xs font-medium text-muted">Next word</span>
              {visibleChips.length === 0 && chipsLoading && <span className="skeleton h-8 w-40 rounded-full" />}
              {visibleChips.map((c) => (
                <button
                  key={c.word}
                  type="button"
                  onClick={() => draftStore.set(applyWord(text, c.word))}
                  className="rounded-full border border-border bg-surface px-3 py-1 text-sm font-medium hover:border-primary hover:text-primary"
                >
                  {c.word}
                </button>
              ))}
              {!text.trim() && <span className="text-xs text-muted">Start typing to see suggestions.</span>}
            </>
          )}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-x-6">
          <span className="inline-flex items-center gap-2 text-sm text-muted"><Type className="h-4 w-4 text-primary" />Creativity</span>
          <div className="flex flex-wrap gap-2">
            {CREATIVITY_VALUES.map((v) => (
              <Chip key={v} active={settings.creativity === v} onClick={() => settingsStore.set({ ...settings, creativity: v })}>
                {LABEL[v]}
              </Chip>
            ))}
          </div>
          <span className="inline-flex items-center gap-2 text-sm text-muted"><SlidersHorizontal className="h-4 w-4 text-primary" />Length</span>
          <div className="flex flex-wrap gap-2">
            {LENGTH_VALUES.map((v) => (
              <Chip key={v} active={settings.length === v} onClick={() => settingsStore.set({ ...settings, length: v })}>
                {LABEL[v]}
              </Chip>
            ))}
          </div>
          <span className="inline-flex items-center gap-2 text-sm text-muted"><Languages className="h-4 w-4 text-primary" />Language mix</span>
          <div className="flex flex-wrap gap-2">
            <Chip active>Hinglish</Chip>
            <Chip disabled title="A Hindi model is coming later">Hindi (soon)</Chip>
          </div>
        </div>

        {error != null && (
          <div className="mt-5">
            <ErrorBanner error={error} onRetry={run} />
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <PrimaryButton onClick={run} disabled={!canRun} className="px-6 py-3">
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Completing" : "Complete sentence"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </PrimaryButton>
          <GhostButton onClick={() => { draftStore.set(""); setChips([]); setError(null); }} disabled={!text || loading}>
            Clear
          </GhostButton>
          <span className="text-xs text-muted">Ctrl or Cmd + Enter</span>
        </div>
      </Card>

      <div className="flex flex-col gap-5">
        <Card>
          <h2 className="text-sm font-bold">Your preferences</h2>
          <ul className="mt-3 flex flex-col gap-4 text-sm">
            <li className="flex items-center justify-between gap-3">
              <span>
                <span className="block font-medium">Live next word</span>
                <span className="block text-xs text-muted">Suggestions as you type</span>
              </span>
              <Switch label="Live next word suggestions" checked={settings.nextWord} onChange={(v) => settingsStore.set({ ...settings, nextWord: v })} />
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>
                <span className="block font-medium">Save to history</span>
                <span className="block text-xs text-muted">Kept only in this browser</span>
              </span>
              <Switch label="Save to history" checked={settings.saveHistory} onChange={(v) => settingsStore.set({ ...settings, saveHistory: v })} />
            </li>
            <li>
              <span className="mb-2 block font-medium">Suggestions per try</span>
              <div className="flex gap-2">
                {([2, 3, 4] as const).map((n) => (
                  <Chip key={n} active={settings.suggestions === n} onClick={() => settingsStore.set({ ...settings, suggestions: n })} className="px-4">
                    {n}
                  </Chip>
                ))}
              </div>
            </li>
          </ul>
        </Card>
        <Card className="bg-soft/60">
          <div className="flex items-start gap-3">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <h2 className="text-sm font-bold">Quick tip</h2>
              <p className="mt-1 text-sm text-muted">Start with the words you have. We will suggest natural continuations. Leave the last word half typed and the next word chips will finish it for you.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
    </div>
  );
}