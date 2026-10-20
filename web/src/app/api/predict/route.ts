import { checkRate } from "@/lib/server/rate-limit";
import { clientIp, errorJson, isSameOrigin, json, readLimitedText } from "@/lib/server/request";
import { rateLimitPerMinute, upstreamConfig } from "@/lib/server/upstream";
import { ValidationError, validatePayload } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2048;
const UPSTREAM_TIMEOUT_MS = 25_000;

type UpstreamError = { error?: { code?: string; message?: string } };

export async function POST(req: Request) {
  if (!isSameOrigin(req.headers)) return errorJson("forbidden", "Not allowed.", 403);
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return errorJson("bad_request", "The request was not valid.", 415);
  }

  const ip = clientIp(req.headers);
  const rate = checkRate(ip, rateLimitPerMinute());
  if (!rate.ok) {
    return errorJson("rate_limited", "Too many requests. Please wait a moment and try again.", 429, {
      "Retry-After": String(rate.retryAfter),
    });
  }

  const text = await readLimitedText(req, MAX_BODY_BYTES);
  if (text === null) return errorJson("too_large", "Request is too large.", 413);

  let payload;
  try {
    payload = validatePayload(JSON.parse(text));
  } catch (err) {
    const message = err instanceof ValidationError ? err.message : "The request was not valid.";
    return errorJson("bad_request", message, 422);
  }

  const upstream = upstreamConfig();
  if (!upstream) {
    return errorJson("not_configured", "The model server is not set up yet.", 503);
  }

  const { mode, ...body } = payload;
  const path = mode === "next-word" ? "/v1/next" : "/v1/complete";
  let res: Response;
  try {
    res = await fetch(upstream.base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": upstream.secret, "X-Client-IP": ip },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return errorJson(
      timedOut ? "timeout" : "unreachable",
      "The model server did not answer. It may be waking up, try again in a moment.",
      timedOut ? 504 : 502,
      { "Retry-After": "10" },
    );
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as UpstreamError;
    const code = data.error?.code ?? "upstream_error";
    if (res.status === 503) {
      return errorJson(
        code === "busy" ? "busy" : "warming_up",
        code === "busy" ? "The model is busy. Try again in a few seconds." : "The model is waking up. Try again shortly.",
        503,
        { "Retry-After": res.headers.get("retry-after") ?? "10" },
      );
    }
    if (res.status === 429) return errorJson("rate_limited", "Too many requests. Please wait a moment.", 429, { "Retry-After": res.headers.get("retry-after") ?? "30" });
    if (res.status === 422 && (code === "bad_request" || code === "no_result")) {
      return errorJson(code, data.error?.message ?? "The request was not valid.", 422);
    }
    console.error("upstream failure", res.status, code); // never log prompts
    return errorJson("upstream_error", "Something went wrong on our side.", 502);
  }

  const data = await res.json().catch(() => null);
  if (!data || typeof data !== "object") return errorJson("upstream_error", "Something went wrong on our side.", 502);
  const d = data as Record<string, unknown>;

  // Rebuild the response from known fields instead of forwarding whatever came back.
  if (mode === "next-word") {
    const list = Array.isArray(d.candidates) ? d.candidates : [];
    const candidates = list
      .filter((c): c is { word: string; score: number } => typeof c?.word === "string" && typeof c?.score === "number")
      .map((c) => ({ word: c.word.slice(0, 40), score: c.score }));
    return json({ mode, candidates, source: "model", latency_ms: Number(d.latency_ms) || 0 });
  }
  const list = Array.isArray(d.suggestions) ? d.suggestions : [];
  const suggestions = list
    .filter((s): s is { text: string; continuation: string } => typeof s?.text === "string" && typeof s?.continuation === "string")
    .map((s) => ({ text: s.text.slice(0, 1200), continuation: s.continuation.slice(0, 900) }));
  if (!suggestions.length) return errorJson("no_result", "The model had nothing to add. Try a longer start.", 422);
  return json({ mode, suggestions, source: "model", latency_ms: Number(d.latency_ms) || 0 });
}
