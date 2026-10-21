import { describe, expect, it } from "vitest";
import { containsBlocked, cutAfterSentences, hasSentenceEnd, isWordToken, joinText, splitFragment } from "./text";

describe("splitFragment", () => {
  it("treats a trailing space as a finished word", () => {
    expect(splitFragment("kal main ")).toEqual({ context: "kal main", fragment: "" });
  });
  it("treats an unfinished last word as a fragment", () => {
    expect(splitFragment("kal milte hain, tim")).toEqual({ context: "kal milte hain,", fragment: "tim" });
  });
  it("handles one word and punctuation endings", () => {
    expect(splitFragment("kal")).toEqual({ context: "", fragment: "kal" });
    expect(splitFragment("theek hai.")).toEqual({ context: "theek hai.", fragment: "" });
  });
});

describe("isWordToken", () => {
  it("accepts words and rejects markers, punctuation and spaces", () => {
    expect(isWordToken("jaa")).toBe(true);
    expect(isWordToken("[EOS]")).toBe(false);
    expect(isWordToken("##ing")).toBe(false);
    expect(isWordToken("!")).toBe(false);
    expect(isWordToken("two words")).toBe(false);
    expect(isWordToken("नमस्ते")).toBe(true);
  });
});

describe("cutAfterSentences", () => {
  it("keeps up to the Nth sentence end", () => {
    expect(cutAfterSentences("pehla. doosra! teesra", 1)).toBe("pehla.");
    expect(cutAfterSentences("pehla. doosra! teesra", 2)).toBe("pehla. doosra!");
  });
  it("returns everything when the end is not reached", () => {
    expect(cutAfterSentences("abhi tak nahi", 1)).toBe("abhi tak nahi");
  });
});

describe("joinText", () => {
  it("joins with one space and glues punctuation", () => {
    expect(joinText("kal milte hain ", "timing bata dena.")).toBe("kal milte hain timing bata dena.");
    expect(joinText("kya hua", "?")).toBe("kya hua?");
    expect(joinText("kal", "  ")).toBe("kal");
  });
});

describe("blocklist and sentence ends", () => {
  it("matches whole words only", () => {
    expect(containsBlocked("this is bad", ["bad"])).toBe(true);
    expect(containsBlocked("badminton", ["bad"])).toBe(false);
    expect(containsBlocked("anything", [])).toBe(false);
  });
  it("spots sentence ending tokens", () => {
    expect(hasSentenceEnd("dena.")).toBe(true);
    expect(hasSentenceEnd("dena")).toBe(false);
  });
});
