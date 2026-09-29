import { describe, expect, it } from "vitest";
import { parseLessonText } from "../../lessons/domain/parser.ts";
import {
  cleanImportText,
  htmlToLessonText,
  IMPORT_CONTENT_TYPES,
  IMPORT_EXAMPLE_OUTPUTS,
  IMPORT_PATH_PATTERN,
  IMPORT_SYSTEM,
  importFolders,
  importObjectPath,
  importPrompt,
  importTitle,
  sniffImport,
} from "./import.ts";

const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(
    parts.flatMap((p) =>
      typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p,
    ),
  );
const ID = "0b5f2d4e-8c1a-4f7e-9d3b-2a6c8e1f0a9b";

describe("paths", () => {
  it("files each upload under its UTC month with the type's extension", () => {
    const now = new Date("2026-10-31T20:00:00Z");
    expect(
      IMPORT_CONTENT_TYPES.map((t) => importObjectPath(now, ID, t)),
    ).toEqual([
      `2026/10/${ID}.pdf`,
      `2026/10/${ID}.docx`,
      `2026/10/${ID}.png`,
      `2026/10/${ID}.jpg`,
      `2026/10/${ID}.webp`,
    ]);
    for (const t of IMPORT_CONTENT_TYPES)
      expect(importObjectPath(now, ID, t)).toMatch(IMPORT_PATH_PATTERN);
    expect("../2026/10/x.pdf").not.toMatch(IMPORT_PATH_PATTERN);
    expect(`2026/10/${ID}.exe`).not.toMatch(IMPORT_PATH_PATTERN);
  });

  it("cleans this month's and last month's folders", () => {
    expect(importFolders(new Date("2026-10-05T00:00:00Z"))).toEqual([
      "2026/09",
      "2026/10",
    ]);
    expect(importFolders(new Date("2027-01-01T00:00:00Z"))).toEqual([
      "2026/12",
      "2027/01",
    ]);
  });
});

describe("sniffImport", () => {
  it("trusts the first bytes, not the declared type", () => {
    expect(sniffImport(bytes("%PDF-1.7\n"))).toEqual({
      kind: "pdf",
      mimeType: "application/pdf",
    });
    expect(sniffImport(bytes([0x50, 0x4b, 0x03, 0x04, 0x14]))).toEqual({
      kind: "docx",
    });
    expect(
      sniffImport(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])),
    ).toEqual({ kind: "image", mimeType: "image/png" });
    expect(sniffImport(bytes([0xff, 0xd8, 0xff, 0xe0]))).toEqual({
      kind: "image",
      mimeType: "image/jpeg",
    });
    expect(sniffImport(bytes("RIFF", [1, 2, 3, 4], "WEBPVP8 "))).toEqual({
      kind: "image",
      mimeType: "image/webp",
    });
    expect(sniffImport(bytes("RIFF", [1, 2, 3, 4], "WAVEfmt "))).toBeNull();
    expect(sniffImport(bytes("MZ\x90\x00"))).toBeNull();
    expect(sniffImport(new Uint8Array())).toBeNull();
  });
});

describe("importTitle", () => {
  it("uses the file name without its extension", () => {
    expect(importTitle("De_kiem-tra  giua ki 1.pdf")).toBe(
      "De kiem tra giua ki 1",
    );
    expect(importTitle(".pdf")).toBe("Bài nhập từ file");
    expect(importTitle(`${"a".repeat(300)}.docx`)).toHaveLength(200);
  });
});

describe("the prompt", () => {
  it("spells out the format and the guardrails", () => {
    expect(IMPORT_SYSTEM).toContain("`Câu N: <đề bài>`");
    expect(IMPORT_SYSTEM).toContain("Answer:");
    expect(IMPORT_SYSTEM).toContain("KHÔNG đoán");
    expect(IMPORT_SYSTEM).toContain("[Hình]");
    expect(importPrompt()).toContain("file đính kèm");
    expect(importPrompt("Câu 1: x")).toMatch(/\n\nCâu 1: x$/);
  });

  it("has worked examples the editor parses: the first clean, the second only missing keys", () => {
    const [clean, missing] = IMPORT_EXAMPLE_OUTPUTS.map((t) =>
      parseLessonText(t),
    );
    expect(clean?.questions.map((q) => q.type)).toEqual(["mcq", "tf", "short"]);
    expect(clean?.issues).toEqual([]);
    // One error per question: the mcq has no `*`, the short answer is empty.
    expect(
      missing?.issues.filter((i) => i.severity === "error").map((i) => i.line),
    ).toHaveLength(2);
  });
});

describe("htmlToLessonText", () => {
  it("turns mammoth's HTML into lines, keeping media images", () => {
    const html = [
      "<h1>ĐỀ KIỂM TRA</h1>",
      "<p><strong>Câu 1:</strong> Tính <em>T</em> &amp; f&nbsp;&lt;1&gt;</p>",
      '<p><img src="media:2026/10/a.png" alt="x" /></p>',
      "<ul><li>A. 1 s</li><li>B. 2 s</li></ul>",
      "<p>Dòng 1<br/>Dòng 2 &#8805; &#x3b1; &quot;&apos;&bogus;</p>",
      "<table><tr><td>1</td><td>B</td></tr><tr><th>2</th><th>C</th></tr></table>",
      '<p><img src="" /><img src="media:../x" /></p>',
      "<p>   </p><p></p><p></p>",
      "<p>&#0;&#99999999;</p>",
    ].join("");
    expect(htmlToLessonText(html)).toBe(
      [
        "ĐỀ KIỂM TRA",
        "Câu 1: Tính T & f <1>",
        "",
        "![](media:2026/10/a.png)",
        "",
        "A. 1 s",
        "B. 2 s",
        "",
        "Dòng 1",
        "Dòng 2 ≥ α \"'&bogus;",
        "1 | B",
        "2 | C",
        "",
        "[Hình]",
        "",
        "[Hình]",
        "",
        "&#0;&#99999999;",
      ].join("\n"),
    );
    expect(htmlToLessonText("<p> </p>")).toBe("");
  });
});

describe("cleanImportText", () => {
  it("drops a wrapping fence and extra blank lines", () => {
    expect(
      cleanImportText("```text\r\nCâu 1: a\r\n\r\n\r\n\r\nCâu 2: b\n```\n"),
    ).toBe("Câu 1: a\n\nCâu 2: b");
    expect(cleanImportText("  Câu 1: a ")).toBe("Câu 1: a");
  });
});
