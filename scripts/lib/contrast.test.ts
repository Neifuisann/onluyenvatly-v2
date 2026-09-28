import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  parseColor,
  readTokens,
  relativeLuminance,
  resolveToken,
} from "./contrast";

describe("contrastRatio", () => {
  it("is 21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("oklch(0 0 0)", "oklch(1 0 0)")).toBeCloseTo(21, 2);
  });

  it("is symmetric and 1:1 for equal colors", () => {
    expect(contrastRatio("#777777", "#777777")).toBe(1);
    expect(contrastRatio("#123456", "#fedcba")).toBeCloseTo(
      contrastRatio("#fedcba", "#123456"),
    );
  });

  it("matches the known ratio for #767676 on white (4.54)", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });

  it("agrees between hex and oklch for the same color", () => {
    // oklch(0.6279 0.2577 29.23) ≈ #ff0000
    const hex = relativeLuminance(parseColor("#ff0000"));
    const ok = relativeLuminance(parseColor("oklch(0.6279 0.2577 29.23)"));
    expect(ok).toBeCloseTo(hex, 2);
  });

  it("accepts percentage lightness and rejects unknown formats", () => {
    expect(relativeLuminance(parseColor("oklch(100% 0 0)"))).toBeCloseTo(1, 3);
    expect(() => parseColor("rgb(0 0 0)")).toThrow();
  });
});

describe("readTokens / resolveToken", () => {
  const css = `:root {\n  --a: #ffffff;\n  --b: var(--a);\n}\n.dark {\n  --a: #000000;\n}\n`;

  it("reads a block and resolves references with fallbacks", () => {
    const root = readTokens(css, ":root");
    const dark = readTokens(css, ".dark");
    expect(resolveToken("b", root)).toBe("#ffffff");
    expect(resolveToken("a", dark, root)).toBe("#000000");
    expect(() => resolveToken("zz", root)).toThrow();
    expect(() => readTokens(css, ".nope")).toThrow();
  });
});
