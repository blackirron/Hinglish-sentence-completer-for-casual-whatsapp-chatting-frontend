import { describe, expect, it } from "vitest";
import { rankNextWords } from "./rank";

const vocab = ["[EOS]", "jaa", "aa", "timing", "time", "tim", "!", "Jaa"];
const base = { decode: (i: number) => vocab[i], special: new Set([0]), blocklist: [] as string[] };

describe("rankNextWords", () => {
  it("returns the highest scoring whole words, skipping markers and punctuation", () => {
    const logits = [9, 5, 4, 3, 2, 1, 8, 0];
    const out = rankNextWords(logits, { ...base, k: 3, fragment: "" });
    expect(out.map((w) => w.word)).toEqual(["jaa", "aa", "timing"]);
  });
  it("gives probabilities that sum to at most one and fall in order", () => {
    const out = rankNextWords([0, 3, 2, 1, 0, 0, 0, 0], { ...base, k: 3, fragment: "" });
    expect(out[0].score).toBeGreaterThan(out[1].score);
    expect(out.reduce((a, w) => a + w.score, 0)).toBeLessThanOrEqual(1);
  });
  it("only keeps words that start with a half typed fragment", () => {
    const out = rankNextWords([0, 5, 4, 3, 2, 1, 0, 0], { ...base, k: 5, fragment: "tim" });
    expect(out.map((w) => w.word)).toEqual(["timing", "time", "tim"]);
  });
  it("drops duplicates ignoring case and blocked words", () => {
    const out = rankNextWords([0, 5, 1, 0, 0, 0, 0, 4], { ...base, k: 5, fragment: "", blocklist: ["aa"] });
    const words = out.map((w) => w.word);
    expect(words[0]).toBe("jaa");
    expect(words.filter((w) => w.toLowerCase() === "jaa")).toHaveLength(1);
    expect(words).not.toContain("aa");
  });
});
