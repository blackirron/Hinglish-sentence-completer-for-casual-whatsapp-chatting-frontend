import { describe, expect, it } from "vitest";
import { validatePayload } from "./validate";

describe("validatePayload", () => {
  it("cleans control characters, collapses spaces and fills defaults", () => {
    const p = validatePayload({ mode: "complete", prompt: "  kal   milte hain\u0000 " });
    expect(p).toMatchObject({ mode: "complete", prompt: "kal milte hain ", n: 3, sentences: 1, creativity: "balanced" });
  });
  it("maps length presets", () => {
    const p = validatePayload({ mode: "complete", prompt: "hi", length: "long" });
    expect(p).toMatchObject({ sentences: 2, max_new: 60 });
  });
  it("keeps a trailing space so the engine knows the word is finished", () => {
    expect(validatePayload({ mode: "next-word", prompt: "kal main " })).toMatchObject({ prompt: "kal main " });
  });
  it("rejects unknown fields, bad numbers, empty and over long prompts", () => {
    expect(() => validatePayload({ mode: "next-word", prompt: "hi", evil: 1 })).toThrow();
    expect(() => validatePayload({ mode: "next-word", prompt: "hi", k: 999 })).toThrow();
    expect(() => validatePayload({ mode: "next-word", prompt: "‮  " })).toThrow();
    expect(() => validatePayload({ mode: "next-word", prompt: "a".repeat(400) })).toThrow();
    expect(() => validatePayload({ mode: "other", prompt: "hi" })).toThrow();
    expect(() => validatePayload("nope")).toThrow();
  });
});
