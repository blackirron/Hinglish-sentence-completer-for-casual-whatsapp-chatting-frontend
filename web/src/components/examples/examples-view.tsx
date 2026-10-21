"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { ArrowRight, Search } from "lucide-react";
import { CATEGORIES, TEMPLATES } from "@/lib/examples";
import { draftStore } from "@/lib/storage";
import { Card, Chip, PageHeader } from "@/components/ui/primitives";

export function ExamplesView() {
  const router = useRouter();
  const [category, setCategory] = React.useState<(typeof CATEGORIES)[number]>("All");
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const list = TEMPLATES.filter(
    (t) => (category === "All" || t.category === category) && (!q || t.title.toLowerCase().includes(q) || t.start.toLowerCase().includes(q)),
  );

  function pick(start: string) {
    draftStore.set(start + " ");
    router.push("/");
  }

  return (
    <div>
      <PageHeader title="Examples and starters">Pick a common situation. We drop the first few words into the box and you take it from there.</PageHeader>

      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {CATEGORIES.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Chip>
          ))}
        </div>
        <label className="relative block w-full sm:w-64">
          <span className="sr-only">Search examples</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            maxLength={60}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search examples"
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>

      {list.length === 0 ? (
        <Card className="text-sm text-muted">No examples match. Try another word or category.</Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => pick(t.start)}
                className="group flex h-full w-full flex-col rounded-2xl border border-border bg-surface/90 p-4 text-left transition-colors hover:border-primary"
              >
                <span className="text-xs font-medium text-muted">{t.category}</span>
                <span className="mt-1 text-sm font-bold">{t.title}</span>
                <span className="mt-2 flex-1 text-sm text-muted">{t.start}...</span>
                <ArrowRight className="mt-3 h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
