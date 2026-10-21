import { ApiError } from "@/lib/api-error";
import { ENGINE_MODE } from "@/lib/engine/config";
import { browserComplete, browserNext } from "@/lib/engine/browser";
import type { Creativity, Length } from "@/lib/limits";
import { validatePayload, ValidationError } from "@/lib/validate";

export { ApiError };

export type Candidate = { word: string; score: number };
export type Suggestion = { text: string; continuation: string };

async function post<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("network", "Could not reach the server. Check your connection and try again.", 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error;
    const retry = Number(res.headers.get("retry-after"));
    throw new ApiError(e?.code ?? "error", e?.message ?? "Something went wrong.", res.status, Number.isFinite(retry) && retry > 0 ? retry : undefined);
  }
  return data as T;
}

/** Same rules as the server proxy, so both engines accept and reject the same input. */
function check(body: Record<string, unknown>) {
  try {
    return validatePayload(body);
  } catch (err) {
    throw new ApiError("bad_request", err instanceof ValidationError ? err.message : "The request was not valid.", 422);
  }
}

export async function predictNext(prompt: string, k: number, signal?: AbortSignal) {
  if (ENGINE_MODE === "server") {
    return post<{ candidates: Candidate[]; latency_ms: number }>({ mode: "next-word", prompt, k }, signal);
  }
  const p = check({ mode: "next-word", prompt, k });
  if (p.mode !== "next-word") throw new ApiError("bad_request", "The request was not valid.", 422);
  return browserNext(p.prompt, p.k, signal);
}

export type CompleteOptions = { prompt: string; n: number; length: Length; creativity: Creativity; seed?: number };

export async function complete(opts: CompleteOptions, signal?: AbortSignal) {
  if (ENGINE_MODE === "server") {
    return post<{ suggestions: Suggestion[]; latency_ms: number }>({ mode: "complete", ...opts }, signal);
  }
  const p = check({ mode: "complete", ...opts });
  if (p.mode !== "complete") throw new ApiError("bad_request", "The request was not valid.", 422);
  return browserComplete({ prompt: p.prompt, n: p.n, sentences: p.sentences, maxNew: p.max_new, creativity: p.creativity }, signal);
}

export async function fetchStatus(signal?: AbortSignal): Promise<"ok" | "warming_up" | "not_configured" | "offline"> {
  try {
    const res = await fetch("/api/health", { cache: "no-store", signal });
    if (!res.ok) return "offline";
    const data = await res.json();
    return data.status === "ok" || data.status === "not_configured" ? data.status : "warming_up";
  } catch {
    return "offline";
  }
}
