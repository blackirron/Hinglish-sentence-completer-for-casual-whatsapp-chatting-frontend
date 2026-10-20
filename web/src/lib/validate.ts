import { CREATIVITY_VALUES, LENGTH_PRESETS, MAX_K, MAX_PROMPT_CHARS, MAX_SUGGESTIONS, type Creativity } from "@/lib/limits";
import { cleanPrompt } from "@/lib/sanitize";

export type NextPayload = { mode: "next-word"; prompt: string; k: number };
export type CompletePayload = {
  mode: "complete";
  prompt: string;
  n: number;
  sentences: number;
  max_new: number;
  creativity: Creativity;
  seed?: number;
};
export type Payload = NextPayload | CompletePayload;

export class ValidationError extends Error {}

function int(value: unknown, min: number, max: number, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new ValidationError("Some of the options were not valid.");
  }
  return value;
}

/** Whitelist every field. Anything unknown is rejected, nothing is forwarded blindly. */
export function validatePayload(input: unknown): Payload {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new ValidationError("The request was not valid.");
  }
  const body = input as Record<string, unknown>;
  const allowed = new Set(["mode", "prompt", "k", "n", "length", "sentences", "max_new", "creativity", "seed"]);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new ValidationError("The request was not valid.");
  }
  if (typeof body.prompt !== "string") throw new ValidationError("Please type something first.");
  const prompt = cleanPrompt(body.prompt);
  if (!prompt.trim()) throw new ValidationError("Please type something first.");
  if (prompt.length > MAX_PROMPT_CHARS) {
    throw new ValidationError(`Keep it under ${MAX_PROMPT_CHARS} characters.`);
  }

  if (body.mode === "next-word") {
    return { mode: "next-word", prompt, k: int(body.k, 1, MAX_K, 5) };
  }
  if (body.mode === "complete") {
    let sentences = 1;
    let max_new = 48;
    if (body.length !== undefined) {
      if (typeof body.length !== "string" || !(body.length in LENGTH_PRESETS)) {
        throw new ValidationError("Some of the options were not valid.");
      }
      ({ sentences, max_new } = LENGTH_PRESETS[body.length as keyof typeof LENGTH_PRESETS]);
    }
    const creativity = (body.creativity ?? "balanced") as Creativity;
    if (!CREATIVITY_VALUES.includes(creativity)) {
      throw new ValidationError("Some of the options were not valid.");
    }
    const seed = body.seed === undefined ? undefined : int(body.seed, 0, 2 ** 31 - 1, 0);
    return {
      mode: "complete",
      prompt,
      n: int(body.n, 1, MAX_SUGGESTIONS, 3),
      sentences: int(body.sentences, 1, 3, sentences),
      max_new: int(body.max_new, 8, 60, max_new),
      creativity,
      ...(seed === undefined ? {} : { seed }),
    };
  }
  throw new ValidationError("The request was not valid.");
}
