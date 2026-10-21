import { containsBlocked, isWordToken } from "./text";

export type RankOptions = {
  k: number;
  /** The half typed last word, if any. Only words that start with it are kept. */
  fragment: string;
  decode: (id: number) => string;
  special: ReadonlySet<number>;
  blocklist: readonly string[];
};

/**
 * Turn the last position's logits into the top k whole words.
 * Scores are probabilities over the full vocabulary, like the server version.
 */
export function rankNextWords(logits: ArrayLike<number>, o: RankOptions): { word: string; score: number }[] {
  const n = logits.length;
  let max = -Infinity;
  for (let i = 0; i < n; i++) if (logits[i] > max) max = logits[i];
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.exp(logits[i] - max);

  const pool = Math.min(o.fragment ? 600 : Math.max(o.k * 6, 40), n);
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => logits[b] - logits[a]).slice(0, pool);

  const frag = o.fragment.toLowerCase();
  const seen = new Set<string>();
  const out: { word: string; score: number }[] = [];
  for (const id of order) {
    if (o.special.has(id)) continue;
    const word = o.decode(id).trim();
    const low = word.toLowerCase();
    if (!isWordToken(word) || seen.has(low)) continue;
    if (frag && !low.startsWith(frag)) continue;
    if (containsBlocked(word, o.blocklist)) continue;
    seen.add(low);
    out.push({ word, score: Math.exp(logits[id] - max) / sum });
    if (out.length >= o.k) break;
  }
  return out;
}
