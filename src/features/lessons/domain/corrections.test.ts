import { describe, expect, it } from "vitest";
import { DEFAULT_LESSON_CONFIG, type Question } from "../schema";
import {
  applyCorrections,
  diffCorrections,
  pointsEditable,
} from "./corrections";
import { parseLessonText } from "./parser";
import { serializeLesson } from "./serializer";
import { countByType, liveQuestions, summarizeLesson } from "./summary";

const questions: Question[] = [
  {
    id: "q_mcq",
    type: "mcq",
    stem: "Tín hiệu số là gì?",
    options: [{ text: "A" }, { text: "B" }, { text: "C" }, { text: "D" }],
    answer: 3,
  },
  {
    id: "q_tf",
    type: "tf",
    stem: "Phát biểu",
    statements: [
      { text: "x", answer: true },
      { text: "y", answer: false },
    ],
  },
  { id: "q_short", type: "short", stem: "Tính", answer: "1.5", points: 2 },
];

const perQuestion = DEFAULT_LESSON_CONFIG;
const byType = {
  ...DEFAULT_LESSON_CONFIG,
  points: { mode: "per-type-total" as const, mcq: 6 },
};

const run = (c: Parameters<typeof applyCorrections>[1], config = perQuestion) =>
  applyCorrections(questions, c, config);

describe("applyCorrections", () => {
  it("changes an mcq key and reports the question", () => {
    const r = run([{ kind: "mcq-answer", questionId: "q_mcq", answer: 1 }]);
    expect(r.ok && r.questions[0]).toMatchObject({ answer: 1 });
    expect(r.ok && r.changed).toEqual(["q_mcq"]);
    expect(r.ok && r.points.size).toBe(0);
  });

  it("flips true/false keys and canonicalizes a short answer", () => {
    const r = run([
      { kind: "tf-answer", questionId: "q_tf", answers: [false, true] },
      { kind: "short-answer", questionId: "q_short", answer: " 2,5 " },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.questions[1]).toMatchObject({
      statements: [{ answer: false }, { answer: true }],
    });
    expect(r.questions[2]).toMatchObject({ answer: "2.5" });
    expect(r.changed).toEqual(["q_tf", "q_short"]);
  });

  it("refuses an answer that does not fit the question", () => {
    expect(
      run([{ kind: "mcq-answer", questionId: "q_mcq", answer: 4 }]).ok,
    ).toBe(false);
    expect(
      run([{ kind: "tf-answer", questionId: "q_tf", answers: [true] }]).ok,
    ).toBe(false);
    expect(
      run([{ kind: "mcq-answer", questionId: "q_tf", answer: 0 }]).ok,
    ).toBe(false);
    expect(
      run([{ kind: "short-answer", questionId: "q_short", answer: "  " }]).ok,
    ).toBe(false);
    expect(run([{ kind: "remove", questionId: "q_nope" }]).ok).toBe(false);
  });

  it("re-prices items when a question's own points change", () => {
    const r = run([{ kind: "points", questionId: "q_mcq", points: 0.5 }]);
    expect(r.ok && [...r.points]).toEqual([["q_mcq", 0.5]]);
    const same = run([{ kind: "points", questionId: "q_mcq", points: 1 }]);
    expect(same.ok && same.points.size).toBe(0);
  });

  it("refuses points of a type whose total is shared, allows the others", () => {
    expect(
      run([{ kind: "points", questionId: "q_mcq", points: 2 }], byType),
    ).toMatchObject({ ok: false });
    expect(
      run([{ kind: "points", questionId: "q_tf", points: 2 }], byType).ok,
    ).toBe(true);
    expect(pointsEditable(byType, "mcq")).toBe(false);
    expect(pointsEditable(perQuestion, "mcq")).toBe(true);
  });

  it("gives a question free and takes it back", () => {
    const on = run([{ kind: "free", questionId: "q_tf", free: true }]);
    expect(on.ok && on.questions[1]?.free).toBe(true);
    if (!on.ok) return;
    const off = applyCorrections(
      on.questions,
      [{ kind: "free", questionId: "q_tf", free: false }],
      perQuestion,
    );
    expect(off.ok && off.questions[1]).toEqual(questions[1]);
  });

  it("removes a question: worth 0 in attempts, gone from counts and text", () => {
    const r = run([{ kind: "remove", questionId: "q_short" }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.questions).toHaveLength(3);
    expect(r.questions[2]?.removed).toBe(true);
    expect([...r.points]).toEqual([["q_short", 0]]);
    expect(countByType(r.questions)).toEqual({ mcq: 1, tf: 1, short: 0 });
    expect(summarizeLesson(r.questions, perQuestion).questionCount).toBe(2);
    expect(serializeLesson(r.questions)).not.toContain("Tính");
    // A removed question can no longer be corrected.
    expect(
      applyCorrections(
        r.questions,
        [{ kind: "free", questionId: "q_short", free: true }],
        perQuestion,
      ).ok,
    ).toBe(false);
  });

  it("keeps at least one question", () => {
    expect(
      run([
        { kind: "remove", questionId: "q_mcq" },
        { kind: "remove", questionId: "q_tf" },
        { kind: "remove", questionId: "q_short" },
      ]),
    ).toMatchObject({ ok: false });
  });

  it("replaces content of the same shape and keeps the id", () => {
    const { questions: parsed } = parseLessonText(
      "Câu 1: Tín hiệu số là gì? (sửa)\n*A. A\nB. B\nC. C\nD. D\n[0.5 pts]",
    );
    const edited = { ...(parsed[0] as Question), id: "q_mcq" };
    const r = run([{ kind: "content", question: edited }]);
    expect(r.ok && r.questions[0]).toMatchObject({
      id: "q_mcq",
      stem: "Tín hiệu số là gì? (sửa)",
      answer: 0,
      points: 0.5,
    });
    expect(r.ok && [...r.points]).toEqual([["q_mcq", 0.5]]);
  });

  it("refuses content that changes the type or the option count", () => {
    const three: Question = {
      id: "q_mcq",
      type: "mcq",
      stem: "x",
      options: [{ text: "A" }, { text: "B" }, { text: "C" }],
      answer: 0,
    };
    const short: Question = {
      id: "q_mcq",
      type: "short",
      stem: "x",
      answer: "1",
    };
    expect(run([{ kind: "content", question: three }]).ok).toBe(false);
    expect(run([{ kind: "content", question: short }]).ok).toBe(false);
  });

  it("reports nothing when a correction changes nothing", () => {
    const r = run([{ kind: "mcq-answer", questionId: "q_mcq", answer: 3 }]);
    expect(r.ok && r.changed).toEqual([]);
  });
});

describe("the [Tặng điểm] marker", () => {
  it("parses and round-trips", () => {
    const { questions: parsed, issues } = parseLessonText(
      "Câu 1: x\nAnswer: 1\n[tặng điểm]",
    );
    expect(issues).toEqual([]);
    expect(parsed[0]?.free).toBe(true);
    expect(serializeLesson(parsed)).toContain("[Tặng điểm]");
  });
});

describe("diffCorrections", () => {
  it("lists what the working copy changed", () => {
    const after: Question[] = [
      { ...(questions[0] as Question), answer: 0, points: 2 } as Question,
      { ...(questions[1] as Question), free: true },
      { ...(questions[2] as Question), removed: true, answer: "9" } as Question,
    ];
    expect(diffCorrections(questions, after)).toEqual([
      { kind: "mcq-answer", questionId: "q_mcq", answer: 0 },
      { kind: "points", questionId: "q_mcq", points: 2 },
      { kind: "free", questionId: "q_tf", free: true },
      { kind: "remove", questionId: "q_short" },
    ]);
    expect(diffCorrections(questions, questions)).toEqual([]);
    const r = applyCorrections(
      questions,
      diffCorrections(questions, after),
      perQuestion,
    );
    expect(r.ok && r.changed).toEqual(["q_mcq", "q_tf", "q_short"]);
  });
});

describe("a removed question and the editor", () => {
  it("never lends its id to a live question when the text is parsed again", () => {
    const r = run([{ kind: "remove", questionId: "q_tf" }]);
    if (!r.ok) throw new Error(r.message);
    // The teacher rewrites question 3's stem in the full editor: no stem
    // match, so the id comes by position among the live questions.
    const text = serializeLesson(r.questions).replace("Tính", "Tính lại");
    const { questions: parsed } = parseLessonText(text, {
      previous: liveQuestions(r.questions),
    });
    expect(parsed.map((q) => q.id)).toEqual(["q_mcq", "q_short"]);
  });
});
