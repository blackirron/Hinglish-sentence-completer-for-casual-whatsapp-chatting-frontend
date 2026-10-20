import { clientIp, errorJson, json } from "@/lib/server/request";
import { checkRate } from "@/lib/server/rate-limit";
import { upstreamConfig } from "@/lib/server/upstream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lets the page show whether the model is awake. Hitting it also wakes a sleeping Space. */
export async function GET(req: Request) {
  const rate = checkRate("health:" + clientIp(req.headers), 30);
  if (!rate.ok) return errorJson("rate_limited", "Slow down.", 429, { "Retry-After": String(rate.retryAfter) });
  const upstream = upstreamConfig();
  if (!upstream) return json({ status: "not_configured" });
  try {
    const res = await fetch(upstream.base + "/v1/health", { cache: "no-store", signal: AbortSignal.timeout(8000) });
    const data = (await res.json()) as { status?: string };
    return json({ status: data.status === "ok" ? "ok" : "warming_up" });
  } catch {
    return json({ status: "warming_up" });
  }
}
