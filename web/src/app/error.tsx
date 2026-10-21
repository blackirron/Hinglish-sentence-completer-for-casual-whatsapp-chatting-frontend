"use client";

import Link from "next/link";

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-muted">Nothing you wrote was lost, your history is stored in this browser. Please try again.</p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={() => retry()} className="h-10 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
          Try again
        </button>
        <Link href="/" className="inline-flex h-10 items-center rounded-xl border border-border bg-surface px-5 text-sm font-semibold">
          Home
        </Link>
      </div>
    </div>
  );
}
