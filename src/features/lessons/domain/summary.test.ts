import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { questionsArb } from "@/test/arbitraries";
import type { Question } from "../schema";
import {
  countByType,
  poolTypeCounts,
  summarizeLesson,
  type TypeCounts,
} from "./summary";

const available: TypeCounts = { mcq: 18, tf: 4, short: 6 };

describe("poolTypeCounts", () => {
  it("takes everything when the pool is off", () => {
    expect(poolTypeCounts(available, { enabled: false, size: 5 })).toEqual(
      available,
    );
  });

  it("takes byType counts, capped, with unlisted types at zero", () => {
    expect(
      poolTypeCounts(available, {
        enabled: true,
        byType: { mcq: 10, tf: 9 },
      }),
    ).toEqual({ mcq: 10, tf: 4, short: 0 });
  });

  it("falls back to size when byType is all zero", () => {
    expect(
      poolTypeCounts(available, {
        enabled: true,
        size: 14,
        byType: { mcq: 0 },
      }),
    ).toEqual({ mcq: 9, tf: 2, short: 3 });
  });

  it("splits a size by largest remainder, mcq first on ties", () => {
    // 10 × (18, 4, 6)/28 = 6.43, 1.43, 2.14 → floors 6, 1, 2; the one left
    // goes to the largest remainder: mcq and tf tie at .43, mcq comes first.
    expect(poolTypeCounts(available, { enabled: true, size: 10 })).toEqual({
      mcq: 7,
      tf: 1,
      short: 2,
    });
    expect(
      poolTypeCounts({ mcq: 1, tf: 1, short: 1 }, { enabled: true, size: 2 }),
    ).toEqual({ mcq: 1, tf: 1, short: 0 });
  });

  it("takes everything when size ≥ total", () => {
    expect(poolTypeCounts(available, { enabled: true, size: 40 })).toEqual(
      available,
    );
  });

  it("always sums to min(size, total) and never exceeds availability (property)", () => {
    fc.assert(
      fc.property(
        fc.record({
          mcq: fc.nat(40),
          tf: fc.nat(10),
          short: fc.nat(10),
        }),
        fc.integer({ min: 1, max: 60 }),
        (avail, size) => {
          const out = poolTypeCounts(avail, { enabled: true, size });
          const total = avail.mcq + avail.tf + avail.short;
          expect(out.mcq + out.tf + out.short).toBe(Math.min(size, total));
          for (const t of ["mcq", "tf", "short"] as const)
            expect(out[t]).toBeLessThanOrEqual(avail[t]);
        },
      ),
    );
  });
});

describe("summarizeLesson", () => {
  it("counts after pool selection and omits zero types", () => {
    const qs: Question[] = [
      { id: "q_1", type: "short", stem: "a", answer: "1" },
      { id: "q_2", type: "short", stem: "b", answer: "2" },
      {
        id: "q_3",
        type: "mcq",
        stem: "c",
        options: [{ text: "x" }, { text: "y" }],
        answer: 0,
      },
    ];
    expect(summarizeLesson(qs, { pool: { enabled: false } })).toEqual({
      questionCount: 3,
      typeCounts: { mcq: 1, short: 2 },
    });
    expect(
      summarizeLesson(qs, { pool: { enabled: true, byType: { short: 1 } } }),
    ).toEqual({ questionCount: 1, typeCounts: { short: 1 } });
  });

  it("matches countByType without a pool (property)", () => {
    fc.assert(
      fc.property(questionsArb, (qs) => {
        const { questionCount } = summarizeLesson(qs, {
          pool: { enabled: false },
        });
        const c = countByType(qs);
        expect(questionCount).toBe(c.mcq + c.tf + c.short);
      }),
    );
  });
});
