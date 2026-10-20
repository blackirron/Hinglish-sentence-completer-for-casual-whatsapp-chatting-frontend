// Shared by the browser and the server route. Keep in step with api/app/config.py.
export const MAX_PROMPT_CHARS = 280; // the API allows 300, we keep a little headroom
export const MAX_K = 10;
export const MAX_SUGGESTIONS = 4;

export type Creativity = "safe" | "balanced" | "playful";
export type Length = "short" | "medium" | "long";

export const CREATIVITY_VALUES: readonly Creativity[] = ["safe", "balanced", "playful"];
export const LENGTH_VALUES: readonly Length[] = ["short", "medium", "long"];

export const LENGTH_PRESETS: Record<Length, { sentences: number; max_new: number }> = {
  short: { sentences: 1, max_new: 24 },
  medium: { sentences: 1, max_new: 48 },
  long: { sentences: 2, max_new: 60 },
};
