import { describe, expect, it } from "vitest";
import type { Question } from "../schema";
import {
  ComposeSchema,
  composeProblem,
  composeTitle,
  pickQuestions,
  shuffled,
  sumCounts,
  uniqueQuestions,
} from "./compose";

const mcq = (id: string, stem = `Câu ${id}`): Question => ({
  id,
  type: "mcq",
  stem,
  options: [{ text: "A" }, { text: "B" }],
  answer: 0,
});
const tf = (id: string): Question => ({
  id,
  type: "tf",
  stem: `Mệnh đề ${id}`,
  statements: [
    { text: "a", answer: true },
    { text: "b", answer: false },
  ],
});
const short = (id: string): Question => ({
  id,
  type: "short",
  stem: `Tính ${id}`,
  answer: "1",
});

/** A seeded LCG, so draws are repeatable. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}

const pool = [
  mcq("q_1"),
  short("q_s1"),
  mcq("q_2"),
  tf("q_t1"),
  mcq("q_3"),
  tf("q_t2"),
  mcq("q_4"),
];

describe("pickQuestions", () => {
  it("draws the asked number of each type, grouped mcq → tf → short", () => {
    const r = pickQuestions(pool, { mcq: 2, tf: 1, short: 1 }, seeded(1));
    if (!r.ok) throw new Error(r.message);
    expect(r.questions.map((q) => q.type)).toEqual([
      "mcq",
      "mcq",
      "tf",
      "short",
    ]);
    expect(new Set(r.questions.map((q) => q.id)).size).toBe(4);
  });

  it("is random: different seeds give different mcq draws", () => {
    const draws = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
        const r = pickQuestions(
          pool,
          { mcq: 2, tf: 0, short: 0 },
          seeded(seed),
        );
        return r.ok ? r.questions.map((q) => q.id).join() : "";
      }),
    );
    expect(draws.size).toBeGreaterThan(1);
  });

  it("refuses more than there is, counting duplicates once", () => {
    const withCopy = [...pool, mcq("q_9", "câu  Q_1")];
    expect(pickQuestions(withCopy, { mcq: 5, tf: 0, short: 0 })).toEqual({
      ok: false,
      message:
        "Cần 5 câu trắc nghiệm nhưng các bài đã chọn chỉ có 4 câu khác nhau.",
    });
    expect(pickQuestions(pool, { mcq: 0, tf: 0, short: 0 }).ok).toBe(false);
  });

  it("takes everything when asked for everything", () => {
    const r = pickQuestions(pool, { mcq: 4, tf: 2, short: 1 }, seeded(3));
    expect(r.ok && r.questions.length).toBe(7);
  });
});

describe("uniqueQuestions", () => {
  it("drops a repeated stem of the same type, ignoring case, spacing and accents", () => {
    expect(
      uniqueQuestions([
        mcq("q_a", "Đơn vị của  chu kì?"),
        mcq("q_b", "đơn vi cua chu ki?"),
        { ...short("q_c"), stem: "Đơn vị của chu kì?" },
      ]).map((q) => q.id),
    ).toEqual(["q_a", "q_c"]);
  });

  it("keeps image-only questions with different pictures", () => {
    const img = (id: string, path: string): Question => ({
      ...mcq(id, ""),
      image: { path },
    });
    expect(
      uniqueQuestions([img("q_a", "a.webp"), img("q_b", "b.webp")]),
    ).toHaveLength(2);
  });
});

describe("shuffled", () => {
  it("is a permutation and leaves its input alone", () => {
    const list = [1, 2, 3, 4, 5];
    const out = shuffled(list, seeded(9));
    expect([...out].sort()).toEqual(list);
    expect(list).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("composeProblem / sumCounts", () => {
  it("sums the chosen lessons and checks each type", () => {
    const available = sumCounts([
      { mcq: 3, tf: 1, short: 0 },
      { mcq: 2, tf: 0, short: 4 },
    ]);
    expect(available).toEqual({ mcq: 5, tf: 1, short: 4 });
    expect(composeProblem({ mcq: 5, tf: 1, short: 4 }, available)).toBeNull();
    expect(composeProblem({ mcq: 0, tf: 2, short: 0 }, available)).toMatch(
      /2 câu đúng\/sai/,
    );
    expect(composeProblem({ mcq: 201, tf: 0, short: 0 }, available)).toBe(
      "Một bài có tối đa 200 câu.",
    );
  });
});

describe("ComposeSchema", () => {
  const valid = {
    title: " Ôn tập ",
    lessonIds: [3, 1],
    counts: { mcq: 2, tf: 0, short: 1 },
  };

  it("accepts and trims a valid request", () => {
    expect(ComposeSchema.parse(valid).title).toBe("Ôn tập");
  });

  it("refuses no lessons, repeats, no questions or extra keys", () => {
    for (const bad of [
      { ...valid, lessonIds: [] },
      { ...valid, lessonIds: [1, 1] },
      { ...valid, counts: { mcq: 0, tf: 0, short: 0 } },
      { ...valid, counts: { mcq: -1, tf: 0, short: 1 } },
      { ...valid, title: "  " },
      { ...valid, extra: 1 },
    ])
      expect(ComposeSchema.safeParse(bad).success).toBe(false);
  });
});

describe("composeTitle", () => {
  it("names one source, counts several", () => {
    expect(composeTitle([{ title: "Sóng cơ" }])).toBe("Ôn tập: Sóng cơ");
    expect(composeTitle([{ title: "a" }, { title: "b" }])).toBe(
      "Ôn tập tổng hợp (2 bài)",
    );
  });
});
