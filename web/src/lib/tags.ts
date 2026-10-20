import { countWords } from "@/lib/text";

/**
 * Plain labels computed from the text itself. They describe what you see (length, ending),
 * they are not claims about tone, because the model has no tone control.
 */
export function tagsFor(text: string): string[] {
  const words = countWords(text);
  const tags = [words <= 7 ? "Short" : words <= 16 ? "Medium" : "Detailed"];
  const trimmed = text.trim();
  if (trimmed.endsWith("?")) tags.push("Question");
  else if (trimmed.endsWith("!")) tags.push("Exclamation");
  if (trimmed.length <= 160 && !trimmed.includes("\n")) tags.push("Chat ready");
  return tags;
}

/** Split a suggestion into the part you typed and the part the model added. */
export function splitSuggestion(input: string, text: string): { head: string; tail: string } {
  const head = input.trimEnd();
  if (head && text.startsWith(head)) return { head, tail: text.slice(head.length) };
  return { head: "", tail: text };
}
