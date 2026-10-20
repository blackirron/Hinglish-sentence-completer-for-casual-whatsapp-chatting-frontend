export type UpstreamConfig = { base: string; secret: string };

export function upstreamConfig(): UpstreamConfig | null {
  const base = process.env.INFERENCE_API_URL?.replace(/\/+$/, "");
  const secret = process.env.API_SHARED_SECRET;
  if (!base || !secret) return null;
  try {
    const url = new URL(base);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !local) return null; // never send the secret in clear text
  } catch {
    return null;
  }
  return { base, secret };
}

export function rateLimitPerMinute(): number {
  const n = Number(process.env.RATE_LIMIT_PER_MIN ?? 20);
  return Number.isFinite(n) ? n : 20;
}
