"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { copyText } from "@/lib/text";
import { draftStore, entriesStore, useStore } from "@/lib/storage";
import { PageHeader } from "@/components/ui/primitives";
import { useNotice } from "@/components/ui/notice";
import { EntryRow } from "@/components/history/entry-row";

export function PhrasesView() {
  const router = useRouter();
  const entries = useStore(entriesStore);
  const { show, node } = useNotice();
  const saved = entries.filter((e) => e.saved);

  return (
    <div>
      <PageHeader title="My phrases">Lines you starred. They live in this browser only.</PageHeader>
      {saved.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface/90 p-6 text-sm text-muted">
          <Star className="mb-2 h-5 w-5 text-primary" />
          Nothing saved yet. Press the star on a suggestion to keep it here.{" "}
          <Link href="/" className="font-semibold text-primary hover:underline">Write something</Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {saved.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              onCopy={async () => show((await copyText(e.output)) ? "Copied" : "Could not copy")}
              onStar={() => entriesStore.set((prev) => prev.map((x) => (x.id === e.id ? { ...x, saved: false } : x)))}
              onReuse={() => { draftStore.set(e.output.slice(0, 280)); router.push("/"); }}
            />
          ))}
        </ul>
      )}
      {node}
    </div>
  );
}
