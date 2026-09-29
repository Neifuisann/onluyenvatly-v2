import { describe, expect, it } from "vitest";
import type {
  McqQuestion,
  ShortQuestion,
  TfQuestion,
} from "../../lessons/schema";
import {
  buildExplainPrompt,
  cleanExplanation,
  EXPLAIN_SYSTEM,
  HASH_PATTERN,
  isFlagged,
  MAX_EXPLANATION_CHARS,
  needsAi,
  questionHash,
  voteDelta,
} from "./explain";

const mcq: McqQuestion = {
  id: "q_1",
  type: "mcq",
  stem: "Một vật dao động điều hòa với biên độ $A = 5$ cm. Quãng đường trong một chu kì là",
  options: [
    { text: "5 cm" },
    { text: "10 cm" },
    { text: "20 cm" },
    { text: "15 cm" },
  ],
  answer: 2,
};

const tf: TfQuestion = {
  id: "q_2",
  type: "tf",
  stem: "Xét con lắc lò xo.",
  statements: [
    { text: "Chu kì phụ thuộc khối lượng.", answer: true },
    { text: "Chu kì phụ thuộc biên độ.", answer: false },
  ],
};

const short: ShortQuestion = {
  id: "q_3",
  type: "short",
  stem: "Tính tần số (Hz).",
  answer: "2.5",
  tolerance: 0.05,
};

describe("questionHash", () => {
  it("is a sha256 hex string", () => {
    expect(questionHash(mcq)).toMatch(HASH_PATTERN);
  });

  it("ignores the id, points, teacher text and whitespace", () => {
    const copy: McqQuestion = {
      ...mcq,
      id: "q_other",
      points: 2,
      explanation: "x",
      stem: `  ${mcq.stem.replace(" ", "   ")}\n`,
    };
    expect(questionHash(copy)).toBe(questionHash(mcq));
  });

  it("changes with the stem, an option, the key or an image", () => {
    const base = questionHash(mcq);
    expect(questionHash({ ...mcq, stem: `${mcq.stem}?` })).not.toBe(base);
    expect(
      questionHash({
        ...mcq,
        options: [...mcq.options.slice(0, 3), { text: "16 cm" }],
      }),
    ).not.toBe(base);
    expect(questionHash({ ...mcq, answer: 1 })).not.toBe(base);
    expect(
      questionHash({ ...mcq, image: { path: "2026/09/a.webp" } }),
    ).not.toBe(base);
  });

  it("covers statements and short answers", () => {
    expect(
      questionHash({
        ...tf,
        statements: [
          { text: "Chu kì phụ thuộc khối lượng.", answer: false },
          { text: "Chu kì phụ thuộc biên độ.", answer: false },
        ],
      }),
    ).not.toBe(questionHash(tf));
    expect(questionHash({ ...short, answer: "2.4" })).not.toBe(
      questionHash(short),
    );
    expect(questionHash({ ...short, tolerance: undefined })).not.toBe(
      questionHash(short),
    );
    const { tolerance: _, ...noTolerance } = short;
    expect(questionHash(noTolerance)).toBe(
      questionHash({ ...noTolerance, tolerance: 0 }),
    );
  });

  it("tells image-only questions apart", () => {
    const a: ShortQuestion = { ...short, stem: "", image: { path: "a.webp" } };
    const b: ShortQuestion = { ...short, stem: "", image: { path: "b.webp" } };
    expect(questionHash(a)).not.toBe(questionHash(b));
  });
});

describe("needsAi", () => {
  it("is false when the teacher wrote an explanation", () => {
    expect(needsAi(mcq)).toBe(true);
    expect(needsAi({ ...mcq, explanation: "  " })).toBe(true);
    expect(needsAi({ ...mcq, explanation: "Vì s = 4A." })).toBe(false);
  });
});

describe("buildExplainPrompt", () => {
  it("lists mcq options with the key and asks for content, not letters", () => {
    const prompt = buildExplainPrompt(mcq);
    expect(prompt).toContain("Loại câu: Trắc nghiệm nhiều lựa chọn");
    expect(prompt).toContain("Đề bài: Một vật dao động");
    expect(prompt).toContain("A. 5 cm\nB. 10 cm\nC. 20 cm\nD. 15 cm");
    expect(prompt).toContain("Đáp án đúng: C. 20 cm");
    expect(prompt).toContain("xáo trộn");
    expect(prompt).toContain("Vì sao các lựa chọn sai là sai");
    expect(prompt).toContain("Tối đa 250 từ.");
    expect(prompt).not.toContain("hình vẽ");
  });

  it("marks each statement true or false", () => {
    const prompt = buildExplainPrompt(tf);
    expect(prompt).toContain("Loại câu: Đúng/Sai");
    expect(prompt).toContain("a) Chu kì phụ thuộc khối lượng. — Đúng");
    expect(prompt).toContain("b) Chu kì phụ thuộc biên độ. — Sai");
    expect(prompt).toContain("Với từng phát biểu");
  });

  it("gives the short answer with its tolerance", () => {
    expect(buildExplainPrompt(short)).toContain(
      "Đáp án đúng: 2.5 (sai số cho phép ±0.05)",
    );
    expect(buildExplainPrompt({ ...short, tolerance: 0 })).toContain(
      "Đáp án đúng: 2.5\n",
    );
  });

  it("says when there is a figure the model cannot see", () => {
    const image = { path: "2026/09/h.webp" };
    expect(buildExplainPrompt({ ...short, image })).toContain("hình vẽ");
    expect(buildExplainPrompt({ ...tf, image })).toContain("hình vẽ");
    const optionImage: McqQuestion = {
      ...mcq,
      stem: "",
      options: [{ text: "", image }, ...mcq.options.slice(1)],
    };
    const prompt = buildExplainPrompt(optionImage);
    expect(prompt).toContain("hình vẽ");
    expect(prompt).toContain("Đề bài: (chỉ có hình)");
    expect(prompt).toContain("A. (hình)");
  });

  it("never includes the teacher's explanation or points", () => {
    const prompt = buildExplainPrompt({
      ...mcq,
      explanation: "BÍ MẬT",
      points: 3,
    });
    expect(prompt).not.toContain("BÍ MẬT");
  });

  it("has a Vietnamese system instruction with the format rules", () => {
    expect(EXPLAIN_SYSTEM).toContain("GDPT 2018");
    expect(EXPLAIN_SYSTEM).toContain("$...$");
  });
});

describe("cleanExplanation", () => {
  it("turns headings into bold lines and bullets into dots", () => {
    expect(
      cleanExplanation("## Ý chính ##\r\n- Một\n* Hai\n  • Ba\n**Giữ**"),
    ).toBe("**Ý chính**\n• Một\n• Hai\n• Ba\n**Giữ**");
  });

  it("drops images and collapses blank lines", () => {
    expect(
      cleanExplanation("Xem ![hình](media:2026/a.webp) nhé\n\n\n\nTiếp"),
    ).toBe("Xem  nhé\n\nTiếp");
  });

  it("caps the length", () => {
    const long = cleanExplanation("a".repeat(MAX_EXPLANATION_CHARS + 50));
    expect(long).toHaveLength(MAX_EXPLANATION_CHARS);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("voteDelta", () => {
  it("counts a new vote, a change and a removal", () => {
    expect(voteDelta(null, "up")).toEqual({ up: 1, down: 0 });
    expect(voteDelta("up", "down")).toEqual({ up: -1, down: 1 });
    expect(voteDelta("down", null)).toEqual({ up: 0, down: -1 });
    expect(voteDelta("up", "up")).toEqual({ up: 0, down: 0 });
  });
});

describe("isFlagged", () => {
  it("needs 3 down votes and no review", () => {
    expect(isFlagged({ votesDown: 3, reviewedAt: null })).toBe(true);
    expect(isFlagged({ votesDown: 2, reviewedAt: null })).toBe(false);
    expect(isFlagged({ votesDown: 9, reviewedAt: new Date() })).toBe(false);
  });
});
