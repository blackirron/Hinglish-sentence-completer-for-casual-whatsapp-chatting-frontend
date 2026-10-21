"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Search } from "lucide-react";
import { copyText } from "@/lib/text";
import { clearHistory, draftStore, entriesStore, removeEntry, settingsStore, useStore } from "@/lib/storage";
import { GhostButton, PageHeader } from "@/components/ui/primitives";
import { useNotice } from "@/components/ui/notice";
import { EntryRow } from "@/components/history/entry-row";

const DAY = 86_400_000;
const RANGES = { all: 0, today: DAY, week: 7 * DAY, month: 30 * DAY } as const;
type Range = keyof typeof RANGES;

const selectClass = "rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function HistoryView() {
  const router = useRouter();
  const entries = useStore(entriesStore);
  const settings = useStore(settingsStore);
  const { show, node } = useNotice();
  const [now] = React.useState(() => Date.now());
  const [query, setQuery] = React.useState("");
  const [range, setRange] = React.useState<Range>("all");
  const [savedOnly, setSavedOnly] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  const q = query.trim().toLowerCase();
  const list = entries.filter(
    (e) =>
      (!savedOnly || e.saved) &&
      (range === "all" || now - e.createdAt <= RANGES[range]) &&
      (!q || e.input.toLowerCase().includes(q) || e.output.toLowerCase().includes(q)),
  );

  return (
    <div>
      <PageHeader
        title="Your history"
        action={
          entries.length > 0 &&
          (confirming ? (
            <span className="flex items-center gap-2 text-sm">
              Clear all, keeping saved phrases?
              <GhostButton onClick={() => { clearHistory(true); setConfirming(false); show("History cleared"); }} className="border-danger text-danger">Yes, clear</GhostButton>
              <GhostButton onClick={() => setConfirming(false)}>Cancel</GhostButton>
            </span>
          ) : (
            <GhostButton onClick={() => setConfirming(true)}>Clear history</GhostButton>
          ))
        }
      >
        Reuse or save what you picked before. It never leaves this browser.
      </PageHeader>

      {!settings.saveHistory && (
        <p className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          Saving to history is off, so new picks are not recorded.{" "}
          <Link href="/settings" className="font-semibold text-primary hover:underline">Change in Settings</Link>
        </p>
      )}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <label className="relative block flex-1">
          <span className="sr-only">Search history</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            maxLength={80}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your history"
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <select aria-label="Time range" value={range} onChange={(e) => setRange(e.target.value as Range)} className={selectClass}>
          <option value="all">All time</option>
          <option value="today">Last 24 hours</option>
          <option value="week">Last 7 days</option>
          <option value="month">Last 30 days</option>
        </select>
        <select aria-label="Type" value={savedOnly ? "saved" : "all"} onChange={(e) => setSavedOnly(e.target.value === "saved")} className={selectClass}>
          <option value="all">All entries</option>
          <option value="saved">Saved only</option>
        </select>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface/90 p-6 text-sm text-muted">
          {entries.length === 0 ? "No history yet. Completions you pick will show up here." : "Nothing matches these filters."}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              onCopy={async () => show((await copyText(e.output)) ? "Copied" : "Could not copy")}
              onStar={() => entriesStore.set((prev) => prev.map((x) => (x.id === e.id ? { ...x, saved: !x.saved } : x)))}
              onReuse={() => { draftStore.set(e.output.slice(0, 280)); router.push("/"); }}
              onDelete={() => removeEntry(e.id)}
            />
          ))}
        </ul>
      )}
      {node}
    </div>
  );
}
