import { TriangleAlert } from "lucide-react";
import { ApiError } from "@/lib/api";

export function ErrorBanner({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const api = error instanceof ApiError ? error : null;
  const waking = api?.code === "warming_up" || api?.code === "timeout" || api?.code === "unreachable";
  const message = waking
    ? "The model server is waking up after being idle. This can take up to a minute, then it stays quick."
    : api?.message ?? "Something went wrong. Please try again.";
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm">
      <TriangleAlert className="h-4 w-4 shrink-0 text-danger" />
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && api?.code !== "rate_limited" && (
        <button type="button" onClick={onRetry} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:border-primary">
          Try again
        </button>
      )}
    </div>
  );
}
