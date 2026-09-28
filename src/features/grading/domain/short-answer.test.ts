import { describe, expect, it } from "vitest";
import {
  normalizeShortAnswer,
  parseShortNumber,
  shortAnswerMatches,
} from "./short-answer";

describe("normalizeShortAnswer", () => {
  it("trims, drops spaces, uses a dot and drops a trailing dot", () => {
    expect(normalizeShortAnswer(" 1,5 ")).toBe("1.5");
    expect(normalizeShortAnswer("1 000")).toBe("1000");
    expect(normalizeShortAnswer("12.")).toBe("12");
    expect(normalizeShortAnswer("\t-0,63\n")).toBe("-0.63");
  });
});

describe("parseShortNumber", () => {
  it("reads decimals and exponents only", () => {
    expect(parseShortNumber("1.5")).toBe(1.5);
    expect(parseShortNumber(".5")).toBe(0.5);
    expect(parseShortNumber("3e8")).toBe(3e8);
    expect(parseShortNumber("-2")).toBe(-2);
    for (const s of ["", "1/2", "1.2.3", "abc", "1e", "0x10", "Infinity"])
      expect(parseShortNumber(s)).toBeNull();
    expect(parseShortNumber("1e999")).toBeNull();
  });
});

describe("shortAnswerMatches", () => {
  it("compares numbers exactly, ignoring float noise", () => {
    expect(shortAnswerMatches("0.3", String(0.1 + 0.2))).toBe(true);
    expect(shortAnswerMatches("300000000", "3e8")).toBe(true);
    expect(shortAnswerMatches("0.63", "0.628")).toBe(false);
  });

  it("uses the tolerance inclusively", () => {
    expect(shortAnswerMatches("1.55", "1.5", 0.05)).toBe(true);
    expect(shortAnswerMatches("1.5501", "1.5", 0.05)).toBe(false);
  });

  it("never matches an empty answer", () => {
    expect(shortAnswerMatches(" ", "")).toBe(false);
  });
});
