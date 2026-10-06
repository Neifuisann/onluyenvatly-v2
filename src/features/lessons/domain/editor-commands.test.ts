import { describe, expect, it } from "vitest";
import {
  applyEdits,
  insertQuestion,
  mathSnippet,
  questionAtLine,
  questionTemplate,
  renumberQuestions,
  toggleCorrect,
} from "./editor-commands";
import { parseLessonText } from "./parser";

const TEXT = `Câu 1: Chu kì?
A. một
*B. hai
  C. ba
Giải thích: so sánh
A. không phải phương án

Câu 2: Đúng hay sai?
*a) đúng
b) sai
\\c) không phải mệnh đề`;

const toggle = (...args: Parameters<typeof toggleCorrect>) =>
  applyEdits(args[0], toggleCorrect(...args));

describe("questionAtLine", () => {
  const headers = [3, 9, 20];
  it.each([
    [1, -1],
    [3, 0],
    [8, 0],
    [9, 1],
    [19, 1],
    [20, 2],
    [99, 2],
  ])("line %i → question %i", (line, index) => {
    expect(questionAtLine(headers, line)).toBe(index);
  });
  it("is -1 without questions", () => {
    expect(questionAtLine([], 5)).toBe(-1);
  });
});

describe("toggleCorrect", () => {
  it("moves the mcq key, keeping indentation", () => {
    const out = toggle(TEXT, 0, "mcq", 2);
    expect(out).toContain("\nB. hai\n  *C. ba\n");
    const q = parseLessonText(out).questions[0];
    expect(q?.type === "mcq" && q.answer).toBe(2);
  });

  it("clears the key when it is clicked again", () => {
    const out = toggle(TEXT, 0, "mcq", 1);
    expect(out).toContain("\nB. hai\n");
    expect(out).not.toMatch(/^\s*\*[A-F]\./mu);
  });

  it("never touches lines inside the explanation", () => {
    expect(toggleCorrect(TEXT, 0, "mcq", 3)).toEqual([]);
    expect(toggle(TEXT, 0, "mcq", 0)).toContain("A. không phải phương án");
  });

  it("toggles one tf statement only", () => {
    const off = toggle(TEXT, 1, "tf", 0);
    expect(off).toContain("\na) đúng\nb) sai");
    const on = toggle(TEXT, 1, "tf", 1);
    expect(on).toContain("\n*a) đúng\n*b) sai");
  });

  it("skips escaped lines and unknown targets", () => {
    expect(toggleCorrect(TEXT, 1, "tf", 2)).toEqual([]);
    expect(toggleCorrect(TEXT, 5, "mcq", 0)).toEqual([]);
    expect(toggleCorrect(TEXT, 1, "mcq", 0)).toEqual([]);
  });
});

describe("renumberQuestions", () => {
  it("numbers headers in order and leaves correct ones alone", () => {
    const text = "Câu 1: a\nA. x\n\ncâu 5. b\n\nCâu  5: c\nCâu 4: d";
    const edits = renumberQuestions(text);
    expect(edits).toHaveLength(2);
    expect(applyEdits(text, edits)).toBe(
      "Câu 1: a\nA. x\n\ncâu 2. b\n\nCâu  3: c\nCâu 4: d",
    );
  });

  it("ignores escaped headers and ones inside numbers", () => {
    const text = "Câu 2: a\n\\Câu 9: chữ\nCâu 1.5 m là gì";
    expect(applyEdits(text, renumberQuestions(text))).toBe(
      "Câu 1: a\n\\Câu 9: chữ\nCâu 1.5 m là gì",
    );
  });
});

describe("insertQuestion", () => {
  it("adds after the cursor's question and renumbers the rest", () => {
    const { edits, line, number } = insertQuestion(TEXT, 2, "short");
    expect(number).toBe(2);
    const out = applyEdits(TEXT, edits);
    const parsed = parseLessonText(out);
    expect(parsed.questions.map((q) => q.type)).toEqual(["mcq", "short", "tf"]);
    expect(parsed.lines[1]).toBe(line);
    expect(out).toContain("Câu 3: Đúng hay sai?");
    expect(parsed.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("starts an empty text", () => {
    const { edits, line } = insertQuestion("", 1, "mcq");
    expect(applyEdits("", edits)).toBe(questionTemplate("mcq", 1));
    expect(line).toBe(1);
  });

  it("appends when the cursor is above the first question", () => {
    const text = "Lời dẫn\n\nCâu 1: a\nAnswer: 1\n\n";
    const { edits, line } = insertQuestion(text, 1, "tf");
    const out = applyEdits(text, edits);
    expect(parseLessonText(out).lines).toEqual([3, line]);
    expect(out).toContain("Câu 2: Nội dung câu hỏi đúng/sai");
  });
});

describe("questionTemplate", () => {
  it.each(["mcq", "tf", "short"] as const)("%s parses without errors", (t) => {
    const parsed = parseLessonText(questionTemplate(t, 1));
    expect(parsed.questions[0]?.type).toBe(t);
    expect(parsed.issues).toEqual([]);
  });
});

describe("mathSnippet", () => {
  it.each([
    ["v = ", "$\\pi$"],
    ["$v = ", "\\pi"],
    ["$a$ và $b", "\\pi"],
    ["$a$ và ", "$\\pi$"],
    ["giá \\$5 và ", "$\\pi$"],
  ])("after %j inserts %j", (before, out) => {
    expect(mathSnippet(before, "\\pi")).toBe(out);
  });
});
