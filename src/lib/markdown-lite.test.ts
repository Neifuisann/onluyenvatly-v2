import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdownLite, splitMath } from "./markdown-lite";

describe("splitMath", () => {
  it("finds all four v1 delimiters", () => {
    expect(splitMath("a $x$ b $$y$$ c \\(z\\) d \\[w\\]")).toEqual([
      { math: false, v: "a " },
      { math: true, tex: "x", display: false },
      { math: false, v: " b " },
      { math: true, tex: "y", display: true },
      { math: false, v: " c " },
      { math: true, tex: "z", display: false },
      { math: false, v: " d " },
      { math: true, tex: "w", display: true },
    ]);
  });

  it("leaves prices, escaped and unclosed dollars as text", () => {
    expect(splitMath("giá 5$ và 10$")).toEqual([
      { math: false, v: "giá 5$ và 10$" },
    ]);
    expect(splitMath("\\$5 và $ x")).toEqual([{ math: false, v: "$5 và $ x" }]);
    expect(splitMath("$$ chưa đóng")).toEqual([
      { math: false, v: "$$ chưa đóng" },
    ]);
    expect(splitMath("$ x $")).toEqual([{ math: false, v: "$ x $" }]);
  });

  it("keeps escaped dollars inside inline math", () => {
    expect(splitMath("$a\\$b$")).toEqual([
      { math: true, tex: "a\\$b", display: false },
    ]);
  });
});

describe("parseInline", () => {
  it("parses bold, italic, nested emphasis and line breaks", () => {
    expect(parseInline("**Chu kì** là *T*\ndòng 2")).toEqual([
      { t: "strong", c: [{ t: "text", v: "Chu kì" }] },
      { t: "text", v: " là " },
      { t: "em", c: [{ t: "text", v: "T" }] },
      { t: "br" },
      { t: "text", v: "dòng 2" },
    ]);
    expect(parseInline("**a *b* c**")).toEqual([
      {
        t: "strong",
        c: [
          { t: "text", v: "a " },
          { t: "em", c: [{ t: "text", v: "b" }] },
          { t: "text", v: " c" },
        ],
      },
    ]);
  });

  it("doesn't treat multiplication stars as emphasis", () => {
    expect(parseInline("2*3*4 và a * b")).toEqual([
      { t: "text", v: "2*3*4 và a * b" },
    ]);
  });

  it("parses media images with and without a size", () => {
    expect(
      parseInline(
        "xem ![Hình 1](media:2026/09/a.webp =640x360) và ![](media:b.png)",
      ),
    ).toEqual([
      { t: "text", v: "xem " },
      { t: "image", alt: "Hình 1", path: "2026/09/a.webp", w: 640, h: 360 },
      { t: "text", v: " và " },
      { t: "image", alt: "", path: "b.png", w: undefined, h: undefined },
    ]);
  });

  it("ignores images that aren't media: paths", () => {
    expect(parseInline("![x](https://evil.example/a.png)")).toEqual([
      { t: "text", v: "![x](https://evil.example/a.png)" },
    ]);
  });
});

describe("parseMarkdownLite", () => {
  it("splits paragraphs on blank lines and keeps math out of emphasis", () => {
    expect(parseMarkdownLite("Đoạn *1* $a*b*c$\n\n\n  Đoạn 2  ")).toEqual([
      [
        { t: "text", v: "Đoạn " },
        { t: "em", c: [{ t: "text", v: "1" }] },
        { t: "text", v: " " },
        { t: "math", tex: "a*b*c", display: false },
      ],
      [{ t: "text", v: "Đoạn 2" }],
    ]);
  });

  it("returns nothing for blank text", () => {
    expect(parseMarkdownLite(" \n \n")).toEqual([]);
  });
});
