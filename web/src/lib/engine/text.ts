// Port of api/app/textutil.py. Keep the two in step, the same rules apply on both paths.
const SENTENCE_END = new Set([".", "?", "!"]);

/** Code points that are not an ending but still count as sentence punctuation in a token. */
export function hasSentenceEnd(text: string): boolean {
  for (const ch of text) if (SENTENCE_END.has(ch)) return true;
  return false;
}

export function splitFragment(prompt: string): { context: string; fragment: string } {
  if (!prompt || /\s$/.test(prompt) || ",.?!;:".includes(prompt[prompt.length - 1])) {
    return { context: prompt.trim(), fragment: "" };
  }
  const cut = prompt.lastIndexOf(" ");
  if (cut === -1) return { context: "", fragment: prompt };
  return { context: prompt.slice(0, cut).trim(), fragment: prompt.slice(cut + 1) };
}

/** A usable suggestion has a letter, no spaces and is not a special marker. */
export function isWordToken(token: string): boolean {
  const t = token.trim();
  if (!t || t.startsWith("[") || t.startsWith("<") || t.startsWith("##")) return false;
  if (t.includes(" ")) return false;
  return /\p{L}/u.test(t);
}

export function cutAfterSentences(text: string, sentences: number): string {
  let seen = 0;
  let index = 0;
  for (const ch of text) {
    index += ch.length;
    if (SENTENCE_END.has(ch)) {
      seen += 1;
      if (seen >= sentences) return text.slice(0, index);
    }
  }
  return text;
}

export function joinText(prompt: string, continuation: string): string {
  const head = prompt.trimEnd();
  const tail = continuation.trim();
  if (!tail) return head;
  if (",.?!;:".includes(tail[0])) return head + tail;
  return `${head} ${tail}`;
}

export function containsBlocked(text: string, blocklist: readonly string[]): boolean {
  if (!blocklist.length) return false;
  const words = new Set((text.toLowerCase().match(/[\p{L}\p{N}_']+/gu) ?? []));
  return blocklist.some((w) => words.has(w));
}
