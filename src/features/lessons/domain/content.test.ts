import { describe, expect, it } from "vitest";
import { DEFAULT_LESSON_CONFIG, type Question } from "../schema";
import { checkPublishable, draftContent, poolProblem } from "./content";

const TEXT = `Câu 1: Chu kì?
*A. s
B. m

Câu 2: Đúng hay sai
*a) x
b) y

Câu 3: T = ?
Answer: 2`;

let n = 0;
const generateId = () => `q_t${++n}`;

const q = (type: Question["type"], i: number): Question =>
  type === "mcq"
    ? {
        id: `q_${i}`,
        type,
        stem: "x",
        options: [{ text: "a" }, { text: "b" }],
        answer: 0,
      }
    : type === "tf"
      ? {
          id: `q_${i}`,
          type,
          stem: "x",
          statements: [
            { text: "a", answer: true },
            { text: "b", answer: false },
          ],
        }
      : { id: `q_${i}`, type, stem: "x", answer: "1" };

describe("draftContent", () => {
  it("keeps the text and every valid question", () => {
    const d = draftContent(TEXT, { generateId });
    expect(d.sourceText).toBe(TEXT);
    expect(d.errors).toBe(0);
    expect(d.questions.map((x) => x.type)).toEqual(["mcq", "tf", "short"]);
  });

  it("drops invalid questions and counts errors", () => {
    const d = draftContent(`${TEXT}\n\nCâu 4: ?\nA. a\nB. b`, { generateId });
    expect(d.errors).toBe(1);
    expect(d.questions).toHaveLength(3);
  });
});

describe("poolProblem", () => {
  const qs = [q("mcq", 1), q("mcq", 2), q("tf", 3)];
  it("accepts a pool that fits or no pool", () => {
    expect(poolProblem({ enabled: false }, qs)).toBeNull();
    expect(poolProblem({ enabled: true, size: 3 }, qs)).toBeNull();
    expect(poolProblem({ enabled: true }, qs)).toBeNull();
    expect(
      poolProblem({ enabled: true, byType: { mcq: 2, tf: 1 } }, qs),
    ).toBeNull();
  });
  it("names the size or type that doesn't fit", () => {
    expect(poolProblem({ enabled: true, size: 4 }, qs)).toMatch(
      /lấy 4 câu .* chỉ có 3 câu/,
    );
    expect(poolProblem({ enabled: true, byType: { tf: 2 } }, qs)).toMatch(
      /2 câu đúng\/sai .* chỉ có 1/,
    );
  });
  it("falls back to the size when every per-type count is zero", () => {
    expect(
      poolProblem({ enabled: true, byType: { mcq: 0 }, size: 9 }, qs),
    ).toMatch(/lấy 9 câu/);
  });
});

describe("checkPublishable", () => {
  it("returns schema-valid questions", () => {
    const r = checkPublishable(TEXT, DEFAULT_LESSON_CONFIG, { generateId });
    expect(r.ok && r.questions).toHaveLength(3);
  });
  it("refuses errors, empty text and pools that don't fit", () => {
    expect(
      checkPublishable("Câu 1: x\nA. a\nB. b", DEFAULT_LESSON_CONFIG),
    ).toMatchObject({ ok: false, message: expect.stringMatching(/còn 1 lỗi/) });
    expect(checkPublishable("  ", DEFAULT_LESSON_CONFIG)).toEqual({
      ok: false,
      message: "Bài chưa có câu hỏi nào.",
    });
    expect(
      checkPublishable(
        TEXT,
        { pool: { enabled: true, size: 10 } },
        { generateId },
      ),
    ).toMatchObject({ ok: false });
  });
  it("refuses more questions than a lesson may hold", () => {
    const many = Array.from(
      { length: 201 },
      (_, i) => `Câu ${i + 1}: x\nAnswer: 1`,
    ).join("\n\n");
    const r = checkPublishable(many, DEFAULT_LESSON_CONFIG, { generateId });
    expect(r.ok).toBe(false);
  });
});
