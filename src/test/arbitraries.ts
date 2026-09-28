/** fast-check generators for lesson content (property tests). */
import fc from "fast-check";
import type {
  McqQuestion,
  Media,
  Question,
  ShortQuestion,
  TfQuestion,
} from "@/features/lessons/schema";

/** Vietnamese-ish words, LaTeX and punctuation that stress parsers and renderers. */
const WORDS = [
  "Một",
  "vật",
  "dao",
  "động",
  "điều",
  "hòa",
  "$x = 5\\cos(2\\pi t)$",
  "$$v_{max} = \\omega A$$",
  "\\frac{1}{2}",
  "cm.",
  "Tính",
  "(s)",
  "**chu kì**",
  "k = 100 N/m",
  "A.",
  "a)",
  "*",
  "Câu",
  "[2 pts]",
  "Answer:",
  "Đáp",
  "án",
];

const word = fc.constantFrom(...WORDS);

/** One line of text: 1–8 words, no leading/trailing space. */
export const lineArb = fc
  .array(word, { minLength: 1, maxLength: 8 })
  .map((ws) => ws.join(" "));

/** 1–3 lines joined by "\n". */
export const textArb = fc
  .array(lineArb, { minLength: 1, maxLength: 3 })
  .map((ls) => ls.join("\n"));

export const mediaArb: fc.Arbitrary<Media> = fc
  .tuple(
    fc.stringMatching(/^[a-z0-9]{1,12}$/),
    fc.option(
      fc.tuple(
        fc.integer({ min: 1, max: 2000 }),
        fc.integer({ min: 1, max: 2000 }),
      ),
      { nil: undefined },
    ),
    fc.option(fc.constantFrom("Hình 1", "Đồ thị", "mạch điện"), {
      nil: undefined,
    }),
  )
  .map(([name, size, alt]) => ({
    path: `2026/09/${name}.webp`,
    ...(size && { w: size[0], h: size[1] }),
    ...(alt !== undefined && { alt }),
  }));

const pointsArb = fc.constantFrom(0, 0.1, 0.25, 0.5, 1, 1.5, 2);

const baseArb = fc.record(
  {
    id: fc.stringMatching(/^[A-Za-z0-9]{8}$/).map((s) => `q_${s}`),
    stem: textArb,
    image: mediaArb,
    points: pointsArb,
    explanation: textArb,
  },
  { requiredKeys: ["id", "stem"] },
);

export const mcqArb: fc.Arbitrary<McqQuestion> = fc
  .tuple(
    baseArb,
    fc.array(
      fc.record({ text: lineArb, image: mediaArb }, { requiredKeys: ["text"] }),
      { minLength: 2, maxLength: 6 },
    ),
    fc.nat(),
  )
  .map(([b, options, n]) => ({
    ...b,
    type: "mcq" as const,
    options,
    answer: n % options.length,
  }));

export const tfArb: fc.Arbitrary<TfQuestion> = fc
  .tuple(
    baseArb,
    fc.array(fc.record({ text: lineArb, answer: fc.boolean() }), {
      minLength: 2,
      maxLength: 8,
    }),
  )
  .map(([b, statements]) => ({ ...b, type: "tf" as const, statements }));

export const shortArb: fc.Arbitrary<ShortQuestion> = fc
  .tuple(
    baseArb,
    fc.oneof(
      fc.constantFrom("1.5", "0.63", "-2", "3e8", "12", "1/2"),
      fc.double({ min: -1e6, max: 1e6, noNaN: true }).map((d) => String(d)),
    ),
    fc.option(fc.constantFrom(0.01, 0.05, 0.5), { nil: undefined }),
  )
  .map(([b, answer, tolerance]) => ({
    ...b,
    type: "short" as const,
    answer,
    ...(tolerance !== undefined && { tolerance }),
  }));

export const questionArb: fc.Arbitrary<Question> = fc.oneof(
  mcqArb,
  tfArb,
  shortArb,
);

/** 1–12 questions with unique ids. */
export const questionsArb: fc.Arbitrary<Question[]> = fc.uniqueArray(
  questionArb,
  { minLength: 1, maxLength: 12, selector: (q) => q.id },
);
