import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isPermutation } from "@/features/lessons/domain/public-question";
import {
  DEFAULT_LESSON_CONFIG,
  type Question,
} from "@/features/lessons/schema";
import { questionsArb } from "@/test/arbitraries";
import {
  buildItems,
  type ItemsConfig,
  orderQuestions,
  questionsForItems,
  selectQuestions,
} from "./build-items";
import { createRng, shuffle } from "./random";

const make = (type: Question["type"], i: number): Question =>
  ({
    id: `q_${type}${i}`,
    type,
    stem: `${type} ${i}`,
    ...(type === "mcq" && {
      options: [{ text: "a" }, { text: "b" }, { text: "c" }, { text: "d" }],
      answer: 0,
    }),
    ...(type === "tf" && {
      statements: [
        { text: "a", answer: true },
        { text: "b", answer: false },
      ],
    }),
    ...(type === "short" && { answer: "1" }),
  }) as Question;

// Teacher order interleaves types on purpose.
const lesson: Question[] = [
  make("mcq", 1),
  make("tf", 1),
  make("mcq", 2),
  make("short", 1),
  make("mcq", 3),
  make("tf", 2),
  make("mcq", 4),
  make("short", 2),
];
const config = (patch: Partial<ItemsConfig> = {}): ItemsConfig => ({
  pool: DEFAULT_LESSON_CONFIG.pool,
  shuffleQuestions: false,
  shuffleOptions: false,
  points: DEFAULT_LESSON_CONFIG.points,
  ...patch,
});
const ids = (qs: readonly { id: string }[]) => qs.map((q) => q.id);

describe("random", () => {
  it("is deterministic per seed and differs across seeds", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seq = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(seq);
    expect(createRng(43)()).not.toBe(seq[0]);
    for (const x of seq) expect(x >= 0 && x < 1).toBe(true);
  });

  it("shuffle returns a permutation without touching the input (property)", () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), fc.integer(), (xs, seed) => {
        const copy = [...xs];
        const out = shuffle(xs, createRng(seed));
        expect(xs).toEqual(copy);
        expect([...out].sort()).toEqual([...xs].sort());
      }),
    );
  });

  it("reaches every order of 3 items", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++)
      seen.add(shuffle([0, 1, 2], createRng(seed)).join(""));
    expect(seen.size).toBe(6);
  });
});

describe("selectQuestions", () => {
  it("takes everything, in order, with the pool off", () => {
    expect(
      ids(selectQuestions(lesson, { enabled: false }, createRng(1))),
    ).toEqual(ids(lesson));
  });

  it("picks the pool's count per type and keeps the teacher's order", () => {
    const picked = selectQuestions(
      lesson,
      { enabled: true, byType: { mcq: 2, tf: 1 } },
      createRng(7),
    );
    expect(picked.filter((q) => q.type === "mcq")).toHaveLength(2);
    expect(picked.filter((q) => q.type === "tf")).toHaveLength(1);
    expect(picked.filter((q) => q.type === "short")).toHaveLength(0);
    const positions = picked.map((q) => lesson.indexOf(q));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("gives different students different questions", () => {
    const pool = { enabled: true, size: 4 };
    const sets = new Set(
      Array.from({ length: 20 }, (_, seed) =>
        ids(selectQuestions(lesson, pool, createRng(seed))).join(","),
      ),
    );
    expect(sets.size).toBeGreaterThan(1);
  });
});

describe("orderQuestions", () => {
  it("keeps the order when shuffle is off", () => {
    expect(ids(orderQuestions(lesson, false, createRng(1)))).toEqual(
      ids(lesson),
    );
  });

  it("shuffles within types and groups mcq → tf → short (v1)", () => {
    const out = orderQuestions(lesson, true, createRng(3));
    expect(out.map((q) => q.type)).toEqual([
      "mcq",
      "mcq",
      "mcq",
      "mcq",
      "tf",
      "tf",
      "short",
      "short",
    ]);
    expect(new Set(ids(out))).toEqual(new Set(ids(lesson)));
  });
});

describe("buildItems", () => {
  it("defaults: all questions, teacher order, no option order, 1 point each", () => {
    expect(buildItems(lesson, config(), createRng(1))).toEqual(
      lesson.map((q) => ({ q: q.id, p: 1 })),
    );
  });

  it("adds an option order to mcq items only when shuffling options", () => {
    const items = buildItems(
      lesson,
      config({ shuffleOptions: true }),
      createRng(5),
    );
    items.forEach((item, i) => {
      const q = lesson[i] as Question;
      if (q.type === "mcq") expect(isPermutation(item.o ?? [], 4)).toBe(true);
      else expect(item.o).toBeUndefined();
    });
  });

  it("fixes the per-type points plan on the selected questions", () => {
    const items = buildItems(
      lesson,
      config({
        pool: { enabled: true, byType: { mcq: 3, short: 2 } },
        shuffleQuestions: true,
        points: { mode: "per-type-total", mcq: 1, short: 1 },
      }),
      createRng(9),
    );
    expect(items.map((i) => i.p)).toEqual([0.34, 0.33, 0.33, 0.5, 0.5]);
  });

  it("is reproducible from the seed and always valid (property)", () => {
    fc.assert(
      fc.property(
        questionsArb,
        fc.integer(),
        fc.boolean(),
        fc.boolean(),
        fc.option(fc.integer({ min: 1, max: 12 }), { nil: undefined }),
        (qs, seed, shuffleQuestions, shuffleOptions, size) => {
          const cfg = config({
            shuffleQuestions,
            shuffleOptions,
            pool: size ? { enabled: true, size } : { enabled: false },
          });
          const items = buildItems(qs, cfg, createRng(seed));
          expect(buildItems(qs, cfg, createRng(seed))).toEqual(items);
          expect(items).toHaveLength(Math.min(size ?? qs.length, qs.length));
          expect(new Set(items.map((i) => i.q)).size).toBe(items.length);
          const byId = new Map(qs.map((q) => [q.id, q]));
          const picked = questionsForItems(items, byId);
          picked.forEach((q, i) => {
            const it = items[i];
            if (q.type === "mcq" && it?.o)
              expect(isPermutation(it.o, q.options.length)).toBe(true);
          });
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe("questionsForItems", () => {
  it("throws when an item's question is gone", () => {
    expect(() => questionsForItems([{ q: "q_x", p: 1 }], new Map())).toThrow();
  });
});
