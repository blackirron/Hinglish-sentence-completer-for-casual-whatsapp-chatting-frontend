import type { Creativity } from "@/lib/limits";

export type EngineState = "idle" | "loading" | "ready" | "error" | "unsupported";

export type Request =
  | { type: "load" }
  | { type: "next"; id: number; prompt: string; k: number }
  | { type: "complete"; id: number; prompt: string; n: number; sentences: number; maxNew: number; creativity: Creativity }
  | { type: "diag"; id: number; prompts: string[] }
  | { type: "cancel"; id: number };

export type Response =
  | { type: "state"; state: EngineState; progress?: number; message?: string }
  | { type: "next"; id: number; candidates: { word: string; score: number }[]; ms: number }
  | { type: "partial"; id: number; text: string }
  | { type: "complete"; id: number; suggestions: { text: string; continuation: string }[]; ms: number }
  | { type: "diag"; id: number; eos: number; vocab: number; rows: { text: string; ids: number[]; next: { word: string; score: number }[]; ms: number }[] }
  | { type: "stale"; id: number }
  | { type: "fail"; id: number; code: string; message: string };
