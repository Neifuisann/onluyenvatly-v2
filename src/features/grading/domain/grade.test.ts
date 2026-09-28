import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { AttemptItem } from "@/db/schema";
import type { Question } from "@/features/lessons/schema";
import { questionArb } from "@/test/arbitraries";
import {
  expectedAnswer,
  grade,
  gradeItem,
  originalOption,
  summarize,
  tfShare,
} from "./grade";

const tf4: Question = {
  id: "q_tf",
  type: "tf",
  stem: "Xét các phát biểu",
  statements: [
    { text: "a", answer: true },
    { text: "b", answer: false },
    { text: "c", answer: true },
    { text: "d", answer: false },
  ],
};
const mcq: Question = {
  id: "q_mcq",
  type: "mcq",
  stem: "Chu kì",
  options: [{ text: "0,2π s" }, { text: "0,63 s" }, { text: "2π s" }],
  answer: 1,
};
const short: Question = {
  id: "q_short",
  type: "short",
  stem: "Tính T",
  answer: "1.5",
};
const item = (q: Question, p = 1, o?: number[]): AttemptItem => ({
  q: q.id,
  p,
  ...(o && { o }),
});

describe("golden: true/false (11 §2)", () => {
  it.each([
    [[true, false, true, false], 1, "correct"],
    [[true, false, true, true], 0.5, "partial"],
    [[true, false, false, true], 0.25, "partial"],
    [[true, true, false, true], 0.1, "partial"],
    [[false, true, false, true], 0, "wrong"],
  ] as const)("THPT 2025: %j → %s × points", (answer, share, outcome) => {
    expect(gradeItem(tf4, item(tf4, 1), answer, "thpt2025")).toEqual({
      earned: share,
      max: 1,
      outcome,
    });
  });

  it("counts an unanswered statement as wrong", () => {
    expect(
      gradeItem(tf4, item(tf4), [true, false, true, null], "thpt2025").earned,
    ).toBe(0.5);
    expect(gradeItem(tf4, item(tf4), [true], "thpt2025").earned).toBe(0.1);
    expect(
      gradeItem(tf4, item(tf4), [null, null, null, null], "thpt2025"),
    ).toEqual({ earned: 0, max: 1, outcome: "blank" });
  });

  it("scales by the question's points and rounds half up to cents", () => {
    expect(
      gradeItem(tf4, item(tf4, 0.25), [true, true, false, true], "thpt2025")
        .earned,
    ).toBe(0.03);
    expect(
      gradeItem(tf4, item(tf4, 2), [true, false, true, true], "thpt2025")
        .earned,
    ).toBe(1);
  });

  it("is proportional with 3 statements, or when configured", () => {
    const tf3: Question = {
      ...tf4,
      statements: tf4.type === "tf" ? tf4.statements.slice(0, 3) : [],
    } as Question;
    expect(
      gradeItem(tf3, item(tf3, 1), [true, false, false], "thpt2025").earned,
    ).toBe(0.67);
    expect(
      gradeItem(tf4, item(tf4, 1), [true, false, true, true], "proportional")
        .earned,
    ).toBe(0.75);
    expect(tfShare(0, 0, "proportional")).toBe(0);
  });

  it("rejects a non-array answer", () => {
    expect(gradeItem(tf4, item(tf4), "Đ", "thpt2025").outcome).toBe("wrong");
  });
});

describe("golden: multiple choice", () => {
  it("maps the displayed letter back through the option order", () => {
    // Displayed: A = original 2, B = original 1 (correct), C = original 0.
    const shuffled = item(mcq, 0.25, [2, 1, 0]);
    expect(gradeItem(mcq, shuffled, "B", "thpt2025")).toEqual({
      earned: 0.25,
      max: 0.25,
      outcome: "correct",
    });
    expect(gradeItem(mcq, shuffled, "A", "thpt2025").outcome).toBe("wrong");
    expect(gradeItem(mcq, item(mcq), "B", "thpt2025").outcome).toBe("correct");
  });

  it("treats letters outside the options and junk as wrong, empty as blank", () => {
    for (const bad of ["D", "b", "AB", 1, ["B"]])
      expect(gradeItem(mcq, item(mcq), bad, "thpt2025").outcome).toBe("wrong");
    for (const blank of [null, undefined, "", "  "])
      expect(gradeItem(mcq, item(mcq), blank, "thpt2025").outcome).toBe(
        "blank",
      );
  });

  it("originalOption handles missing order entries", () => {
    expect(originalOption("C", { o: [1, 0] }, 3)).toBeNull();
    expect(originalOption("C", {}, 3)).toBe(2);
  });
});

describe("golden: short answer", () => {
  it.each([
    "1,5",
    "1.5",
    " 1.50 ",
    "1.5.",
    "+1.5",
    "15e-1",
  ])("accepts %j for 1.5", (given) => {
    expect(gradeItem(short, item(short), given, "thpt2025").outcome).toBe(
      "correct",
    );
  });

  it("rejects other numbers, including unrounded ones", () => {
    for (const given of ["1.51", "-1.5", "0.15", "1 .6"])
      expect(gradeItem(short, item(short), given, "thpt2025").outcome).toBe(
        "wrong",
      );
    const t: Question = { ...short, answer: "0.63" } as Question;
    expect(gradeItem(t, item(t), "0.628", "thpt2025").outcome).toBe("wrong");
  });

  it("applies an absolute tolerance", () => {
    const t: Question = { ...short, tolerance: 0.05 } as Question;
    expect(gradeItem(t, item(t), "1,55", "thpt2025").outcome).toBe("correct");
    expect(gradeItem(t, item(t), "1.45", "thpt2025").outcome).toBe("correct");
    expect(gradeItem(t, item(t), "1.56", "thpt2025").outcome).toBe("wrong");
  });

  it("falls back to a normalized text comparison", () => {
    const t: Question = { ...short, answer: "1/2" } as Question;
    expect(gradeItem(t, item(t), " 1 / 2 ", "thpt2025").outcome).toBe(
      "correct",
    );
    expect(gradeItem(t, item(t), "0.5", "thpt2025").outcome).toBe("wrong");
    const word: Question = { ...short, answer: "Tăng" } as Question;
    expect(gradeItem(word, item(word), "tăng", "thpt2025").outcome).toBe(
      "correct",
    );
  });

  it("gives 0 for empty and non-text answers", () => {
    expect(gradeItem(short, item(short), "", "thpt2025")).toEqual({
      earned: 0,
      max: 1,
      outcome: "blank",
    });
    expect(gradeItem(short, item(short), [true], "thpt2025").outcome).toBe(
      "wrong",
    );
  });
});

describe("grade", () => {
  const qs = [mcq, tf4, short];
  const items = [item(mcq, 0.25, [1, 0, 2]), item(tf4, 1), item(short, 0.5)];

  it("sums marks exactly and normalizes to 10 with 2 decimals", () => {
    const r = grade(
      qs,
      items,
      ["A", [true, false, true, true], "1,5"],
      "thpt2025",
    );
    expect(r.earned).toEqual([0.25, 0.5, 0.5]);
    expect(r.score).toBe(1.25);
    expect(r.maxScore).toBe(1.75);
    // 1.25 / 1.75 × 10 = 7.142857…
    expect(r.score10).toBe(7.14);
    expect(r.marks.map((m) => m.outcome)).toEqual([
      "correct",
      "partial",
      "correct",
    ]);
  });

  it("treats missing answers as blank", () => {
    const r = grade(qs, items, [], "thpt2025");
    expect(r.score).toBe(0);
    expect(r.marks.every((m) => m.outcome === "blank")).toBe(true);
  });

  it("rounds score10 half up", () => {
    // 2/3 × 10 = 6.666… → 6.67; 0.1 + 0.2 stays exact through cents.
    expect(
      summarize([
        { earned: 1, max: 1, outcome: "correct" },
        { earned: 1, max: 1, outcome: "correct" },
        { earned: 0, max: 1, outcome: "wrong" },
      ]).score10,
    ).toBe(6.67);
    expect(
      summarize([
        { earned: 0.1, max: 0.1, outcome: "correct" },
        { earned: 0.2, max: 0.2, outcome: "correct" },
      ]),
    ).toMatchObject({ score: 0.3, maxScore: 0.3, score10: 10 });
    expect(summarize([]).score10).toBe(0);
  });

  it("refuses misaligned questions and items", () => {
    expect(() => grade([mcq], items, [], "thpt2025")).toThrow();
    expect(() => grade([tf4], [item(mcq)], [], "thpt2025")).toThrow();
  });

  it("gives full marks for the expected answers (property)", () => {
    fc.assert(
      fc.property(
        questionArb,
        fc.constantFrom(0.25, 0.5, 1, 2),
        fc.boolean(),
        (q, p, reversed) => {
          const o =
            q.type === "mcq" && reversed
              ? q.options.map((_, i) => q.options.length - 1 - i)
              : undefined;
          const it = item(q, p, o);
          const r = grade([q], [it], [expectedAnswer(q, it)], "thpt2025");
          expect(r.score).toBe(p);
          expect(r.marks[0]?.outcome).toBe("correct");
        },
      ),
      { numRuns: 300 },
    );
  });

  it("never scores more than the maximum or less than 0 (property)", () => {
    const answerArb = fc.oneof(
      fc.constant(null),
      fc.constantFrom("A", "B", "C", "D", "Z", "1,5", ""),
      fc.array(fc.option(fc.boolean(), { nil: null }), { maxLength: 8 }),
      fc.string(),
    );
    fc.assert(
      fc.property(questionArb, answerArb, (q, answer) => {
        const r = grade([q], [item(q, 1)], [answer], "thpt2025");
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(r.maxScore);
      }),
      { numRuns: 500 },
    );
  });
});
