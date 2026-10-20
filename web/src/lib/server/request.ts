import { isIP } from "node:net";

export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real && isIP(real)) return real;
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (first && isIP(first)) return first;
  return "unknown";
}

/** Block cross site browser posts. Same site fetches from our pages always pass. */
export function isSameOrigin(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = headers.get("origin");
  if (origin) {
    const host = headers.get("x-forwarded-host") ?? headers.get("host");
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

export function errorJson(code: string, message: string, status: number, extra: Record<string, string> = {}) {
  return json({ error: { code, message } }, status, extra);
}

export async function readLimitedText(req: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return null;
  const text = await req.text();
  return new TextEncoder().encode(text).length > maxBytes ? null : text;
}
