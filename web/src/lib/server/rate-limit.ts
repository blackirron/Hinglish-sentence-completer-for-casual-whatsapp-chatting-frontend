// Sliding window limiter held in memory. On serverless each instance has its own window, so this
// is a first line of defence. The API repeats the check with the real visitor IP.
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_KEYS = 5_000;

export function checkRate(key: string, perMinute: number, now = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
  if (perMinute <= 0) return { ok: true };
  if (hits.size > MAX_KEYS) {
    for (const [k, list] of hits) {
      if (!list.length || now - list[list.length - 1] > WINDOW_MS) hits.delete(k);
    }
  }
  const list = (hits.get(key) ?? []).filter((t) => now - t <= WINDOW_MS);
  if (list.length >= perMinute) {
    hits.set(key, list);
    return { ok: false, retryAfter: Math.max(1, Math.ceil((WINDOW_MS - (now - list[0])) / 1000)) };
  }
  list.push(now);
  hits.set(key, list);
  return { ok: true };
}

export function resetRateLimits() {
  hits.clear();
}
