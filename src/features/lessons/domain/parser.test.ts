import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { questionsArb } from "@/test/arbitraries";
import type { Question } from "../schema";
import { QuestionsSchema } from "../schema";
import { type ParseOptions, parseLessonText, stemKey } from "./parser";
import { serializeLesson } from "./serializer";

/** Deterministic ids for tests: q_new1, q_new2, … */
function counter(): ParseOptions {
  let n = 0;
  return { generateId: () => `q_new${++n}` };
}

const errors = (text: string) =>
  parseLessonText(text, counter()).issues.filter((i) => i.severity === "error");

// The sample from 04 §3.3.
const SAMPLE = `Câu 1: Một vật dao động điều hòa với phương trình $x = 5\\cos(2\\pi t)$ cm. Biên độ là
A. 2 cm
*B. 5 cm
C. 10 cm
D. $2\\pi$ cm
[0.25 pts]

Câu 2: Xét các phát biểu sau về con lắc lò xo:
*a) Chu kì phụ thuộc vào khối lượng vật.
b) Chu kì phụ thuộc vào biên độ.
*c) Cơ năng tỉ lệ với bình phương biên độ.
d) Tần số tăng khi tăng khối lượng.

Câu 3: Tính chu kì (s) của con lắc có $k = 100$ N/m, $m = 1$ kg.
Answer: 0,63`;

describe("parseLessonText", () => {
  it("parses the 04 §3.3 sample", () => {
    const { questions, lines, issues } = parseLessonText(SAMPLE, counter());
    expect(issues).toEqual([]);
    expect(lines).toEqual([1, 8, 14]);
    expect(questions).toEqual([
      {
        id: "q_new1",
        type: "mcq",
        stem: "Một vật dao động điều hòa với phương trình $x = 5\\cos(2\\pi t)$ cm. Biên độ là",
        options: [
          { text: "2 cm" },
          { text: "5 cm" },
          { text: "10 cm" },
          { text: "$2\\pi$ cm" },
        ],
        answer: 1,
        points: 0.25,
      },
      {
        id: "q_new2",
        type: "tf",
        stem: "Xét các phát biểu sau về con lắc lò xo:",
        statements: [
          { text: "Chu kì phụ thuộc vào khối lượng vật.", answer: true },
          { text: "Chu kì phụ thuộc vào biên độ.", answer: false },
          { text: "Cơ năng tỉ lệ với bình phương biên độ.", answer: true },
          { text: "Tần số tăng khi tăng khối lượng.", answer: false },
        ],
      },
      {
        id: "q_new3",
        type: "short",
        stem: "Tính chu kì (s) của con lắc có $k = 100$ N/m, $m = 1$ kg.",
        answer: "0.63",
      },
    ]);
    expect(QuestionsSchema.safeParse(questions).success).toBe(true);
  });

  it("reads explanations, images, tolerance and v1 trailing points", () => {
    const text = [
      "câu 1. Cho mạch điện như hình [1,5 điểm]",
      "![Mạch RLC](media:2026/09/abc.webp =640x360)",
      "Tính cường độ dòng điện (A).",
      "Answer: 1,25 ± 0,05",
      "Giải thích: Áp dụng định luật Ôm:",
      "$I = U/R$",
      "",
      "A. không phải phương án",
    ].join("\r\n");
    const { questions, issues } = parseLessonText(text, counter());
    expect(issues).toEqual([]);
    expect(questions[0]).toEqual({
      id: "q_new1",
      type: "short",
      stem: "Cho mạch điện như hình\nTính cường độ dòng điện (A).",
      image: { path: "2026/09/abc.webp", w: 640, h: 360, alt: "Mạch RLC" },
      answer: "1.25",
      tolerance: 0.05,
      points: 1.5,
      explanation:
        "Áp dụng định luật Ôm:\n$I = U/R$\n\nA. không phải phương án",
    });
  });

  it("continues multi-line options and attaches option images", () => {
    const { questions, issues } = parseLessonText(
      [
        "Câu 1: Đồ thị nào đúng?",
        "*A.",
        "![](media:a.webp)",
        "B. dòng một",
        "dòng hai",
        "\\frac{1}{2} vẫn là chữ",
      ].join("\n"),
      counter(),
    );
    expect(issues).toEqual([]);
    expect(questions[0]).toMatchObject({
      options: [
        { text: "", image: { path: "a.webp" } },
        { text: "dòng một\ndòng hai\n\\frac{1}{2} vẫn là chữ" },
      ],
      answer: 0,
    });
  });

  it("treats a backslash before a structural line as plain text", () => {
    const { questions, issues } = parseLessonText(
      "Câu 1: Đề\n\\A. không phải phương án\n\\\\B. có một dấu \\\nAnswer: 1",
      counter(),
    );
    expect(issues).toEqual([]);
    expect(questions[0]?.stem).toBe(
      "Đề\nA. không phải phương án\n\\B. có một dấu \\",
    );
  });

  it.each([
    ["Câu 1: Đề\nA. x\nB. y", "MCQ_NO_ANSWER", 1, 1],
    ["Câu 1: Đề\n*A. x\n*B. y", "MCQ_MULTIPLE_ANSWERS", 3, 1],
    ["Câu 1: Đề\n*A. x", "MCQ_TOO_FEW_OPTIONS", 1, 1],
    ["Câu 1: Đề\n*A. x\nC. y", "OPTION_ORDER", 3, 1],
    ["Câu 1: Đề\n*A. x\n  b) y", "MIXED_TYPES", 3, 3],
    ["Câu 1: Đề\n*a) x\nAnswer: 2", "MIXED_TYPES", 3, 1],
    ["Câu 1: Đề\n*a) x", "TF_TOO_FEW_STATEMENTS", 1, 1],
    ["Câu 1: Đề\nAnswer:", "SHORT_EMPTY_ANSWER", 1, 1],
    ["Câu 1: Đề\nAnswer: 1\nAnswer: 2", "DUPLICATE_ANSWER", 3, 1],
    ["Câu 1: Đề\nAnswer: 1 ± x", "INVALID_TOLERANCE", 2, 1],
    ["Câu 1: Đề\nAnswer: 1\n[200 pts]", "INVALID_POINTS", 3, 1],
    ["Câu 1: Đề", "NO_ANSWER_FORMAT", 1, 1],
    ["Câu 1:\nAnswer: 1", "EMPTY_STEM", 1, 1],
    [
      "Câu 1: Đề\n![](media:a.webp)\n![](media:b.webp)\nAnswer: 1",
      "DUPLICATE_IMAGE",
      3,
      1,
    ],
    ["Câu 1: Đề\n*a) x\n![](media:a.webp)\nb) y", "IMAGE_NOT_ALLOWED", 3, 1],
    [`Câu 1: ${"x".repeat(10_001)}\nAnswer: 1`, "INVALID", 1, 1],
  ])("reports %j as %s at line %i, col %i", (text, code, line, col) => {
    const found = errors(text);
    expect(found).toContainEqual(
      expect.objectContaining({ code, line, col, questionIndex: 0 }),
    );
    expect(found.every((i) => i.message.length > 0)).toBe(true);
  });

  it("warns about text before the first question and about repeated points", () => {
    const { issues } = parseLessonText(
      "Đề kiểm tra\nghi chú\nCâu 1: Đề\nAnswer: 1\n[1 pts]\n[2 pts]",
      counter(),
    );
    expect(issues.map((i) => [i.code, i.severity, i.line])).toEqual([
      ["TEXT_BEFORE_FIRST_QUESTION", "warning", 1],
      ["DUPLICATE_POINTS", "warning", 6],
    ]);
  });

  it("returns nothing for an empty text", () => {
    expect(parseLessonText("  \n\n", counter())).toEqual({
      questions: [],
      lines: [],
      issues: [],
    });
  });

  it("generates random q_ ids by default", () => {
    const { questions } = parseLessonText(
      "Câu 1: a\nAnswer: 1\nCâu 2: b\nAnswer: 2",
    );
    const [a, b] = questions.map((q) => q.id);
    expect(a).toMatch(/^q_[0-9A-Za-z]{8}$/);
    expect(a).not.toBe(b);
  });
});

describe("question ids across edits", () => {
  const previous: Question[] = [
    { id: "q_aaaa", type: "short", stem: "Tính chu kì", answer: "1" },
    { id: "q_bbbb", type: "short", stem: "Tính tần số", answer: "2" },
    {
      id: "q_cccc",
      type: "tf",
      stem: "Phát biểu",
      statements: [
        { text: "x", answer: true },
        { text: "y", answer: false },
      ],
    },
  ];

  it("keeps ids when questions move, by stem", () => {
    const { questions } = parseLessonText(
      "Câu 1: TÍNH  TẦN SỐ\nAnswer: 2\nCâu 2: Tính chu kì\nAnswer: 1",
      { ...counter(), previous },
    );
    expect(questions.map((q) => q.id)).toEqual(["q_bbbb", "q_aaaa"]);
  });

  it("keeps the id of an edited stem at the same position and type", () => {
    const { questions } = parseLessonText(
      "Câu 1: Tính chu kì (s)\nAnswer: 1\nCâu 2: Tính tần số\nAnswer: 2\nCâu 3: Phát biểu mới\n*A. x\nB. y",
      { ...counter(), previous },
    );
    expect(questions.map((q) => q.id)).toEqual(["q_aaaa", "q_bbbb", "q_new1"]);
  });

  it("never reuses an id twice or collides with an old one", () => {
    let n = 0;
    const ids = ["q_aaaa", "q_cccc", "q_fresh"];
    const { questions } = parseLessonText(
      "Câu 1: Tính chu kì\nAnswer: 1\nCâu 2: Tính chu kì\nAnswer: 1\nCâu 3: Mới\nAnswer: 3",
      { previous, generateId: () => ids[n++] ?? "q_x" },
    );
    // The repeated stem falls back to the id at its position (q_bbbb, same
    // type). Question 3 is new (position 3 is a tf question), and generated
    // ids that collide with any previous id are skipped.
    expect(questions.map((q) => q.id)).toEqual(["q_aaaa", "q_bbbb", "q_fresh"]);
  });

  it("matches image-only stems by their image", () => {
    const imageOnly: Question[] = [
      {
        id: "q_img1",
        type: "short",
        stem: "",
        image: { path: "legacy/a.jpg" },
        answer: "1",
      },
      {
        id: "q_img2",
        type: "short",
        stem: "",
        image: { path: "legacy/b.jpg" },
        answer: "2",
      },
    ];
    const { questions, issues } = parseLessonText(
      "Câu 1:\n![](media:legacy/b.jpg)\nAnswer: 2\nCâu 2:\n![](media:legacy/a.jpg)\nAnswer: 1",
      { ...counter(), previous: imageOnly },
    );
    expect(issues).toEqual([]);
    expect(questions.map((q) => q.id)).toEqual(["q_img2", "q_img1"]);
  });

  it("still rejects a question with neither text nor image", () => {
    const { issues } = parseLessonText("Câu 1:\nAnswer: 2", counter());
    expect(issues.map((i) => i.code)).toContain("EMPTY_STEM");
  });

  it("compares stems without case, spacing or accents", () => {
    expect(stemKey("  Dao   ĐỘNG\ncơ ")).toBe(stemKey("dao động cơ"));
  });
});

describe("serializeLesson ∘ parseLessonText", () => {
  it("round-trips the sample", () => {
    const first = parseLessonText(SAMPLE, counter()).questions;
    const again = parseLessonText(serializeLesson(first), { previous: first });
    expect(again.issues).toEqual([]);
    expect(again.questions).toEqual(first);
  });

  it("round-trips any valid lesson (property)", () => {
    fc.assert(
      fc.property(questionsArb, (qs) => {
        const text = serializeLesson(qs);
        const { questions, issues } = parseLessonText(text, { previous: qs });
        expect(issues).toEqual([]);
        expect(questions).toEqual(qs);
      }),
      { numRuns: 1000 },
    );
  });

  it("moves a stem that ends like a points marker off the header line", () => {
    const qs: Question[] = [
      { id: "q_1", type: "short", stem: "Ghi [2 pts]\nrồi tính", answer: "1" },
    ];
    const text = serializeLesson(qs);
    expect(text.split("\n")[0]).toBe("Câu 1:");
    expect(parseLessonText(text, { previous: qs }).questions).toEqual(qs);
  });
});
