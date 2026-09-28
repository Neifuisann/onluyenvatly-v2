import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { QuestionsSchema } from "../schema";
import {
  cleanLegacyText,
  defaultV1MediaPath,
  normalizeV1Config,
  normalizeV1Grade,
  normalizeV1Questions,
  normalizeV1Tags,
  TF_DEFAULT_STEM,
} from "./legacy";
import { parseLessonText } from "./parser";
import { serializeLesson } from "./serializer";

type V1Row = Record<string, unknown>;
const load = (path: string): V1Row[] =>
  existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : [];

/** Synthetic v1-shaped lessons (hand-written, no real data). */
const SAMPLE = load("tests/fixtures/v1-sample/lessons.json");
/** Anonymized real export from S0-05 (`pnpm v1:fixtures`), when present. */
const REAL = load("tests/fixtures/v1/lessons.json");

describe("round trip over v1 lessons (11 §2)", () => {
  const all = [
    ...SAMPLE.map((l) => ["sample", l] as const),
    ...REAL.map((l) => ["v1 export", l] as const),
  ];

  it.each(
    all,
  )("%s lesson %#: normalize → serialize → parse is lossless", (_, row) => {
    const { questions } = normalizeV1Questions(row.questions);
    expect(questions.length).toBeGreaterThan(0);
    expect(QuestionsSchema.safeParse(questions).success).toBe(true);
    const text = serializeLesson(questions);
    const parsed = parseLessonText(text, { previous: questions });
    expect(parsed.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(parsed.questions).toEqual(questions);
  });
});

describe("normalizeV1Questions", () => {
  const [gk1, song, dien] = SAMPLE;

  it("maps types, answers, points, images and HTML (lesson 1)", () => {
    const { questions, problems, mediaUrls } = normalizeV1Questions(
      gk1?.questions,
    );
    expect(questions.map((q) => [q.id, q.type])).toEqual([
      ["q_1", "mcq"],
      ["q_2", "mcq"],
      ["q_3", "mcq"],
      ["q_4", "tf"],
      ["q_5", "short"],
    ]);
    expect(questions[0]).toMatchObject({
      stem: "Một vật dao động điều hòa với phương trình $x = 5\\cos(2\\pi t)$ cm. Biên độ là",
      answer: 1,
      points: 0.25,
    });
    // Padded empty option dropped, lowercase letter, image extracted, <br> kept.
    expect(questions[1]).toEqual({
      id: "q_2",
      type: "mcq",
      stem: "Cho đồ thị như hình\nChu kì dao động là",
      image: { path: "legacy/do-thi-1.png" },
      options: [{ text: "0,5 s" }, { text: "1 s" }, { text: "2 s" }],
      answer: 2,
      points: 2,
    });
    expect(questions[2]).not.toHaveProperty("points");
    expect(questions[3]).toMatchObject({
      statements: [
        { answer: true },
        { answer: false },
        { answer: true },
        { answer: false },
      ],
    });
    expect(questions[3]).not.toHaveProperty("points");
    expect(questions[4]).toMatchObject({ answer: "0.63", points: 0.5 });
    expect(problems).toEqual([
      expect.objectContaining({ index: 1, severity: "warning" }),
      expect.objectContaining({
        index: 5,
        severity: "error",
        message: expect.stringContaining("essay"),
      }),
    ]);
    expect(mediaUrls).toEqual([
      "https://abc.supabase.co/storage/v1/object/public/lesson-images/do-thi-1.png",
    ]);
  });

  it("handles missing/duplicate ids, option images and bad answers (lesson 2)", () => {
    const { questions, problems } = normalizeV1Questions(song?.questions);
    expect(questions.map((q) => q.id)).toEqual(["q_x1", "q_7", "q_1", "q_x4"]);
    expect(questions[0]).toMatchObject({ type: "tf" });
    expect(questions[1]).toMatchObject({ type: "short", answer: "10" });
    expect(questions[2]).toMatchObject({
      stem: "Sóng cơ không truyền được trong môi trường nào?",
      options: [
        { text: "Rắn" },
        { text: "Lỏng" },
        { text: "Khí" },
        { text: "Chân không", image: { path: "legacy/vacuum.png" } },
      ],
      answer: 3,
    });
    expect(problems.filter((p) => p.severity === "error")).toEqual([
      expect.objectContaining({
        index: 4,
        message: expect.stringContaining("not found"),
      }),
    ]);
  });

  it("keeps LaTeX lines and non-numeric short answers; rejects bad tf answers (lesson 3)", () => {
    const { questions, problems } = normalizeV1Questions(dien?.questions);
    expect(questions[0]?.stem).toBe(
      "Hai điện tích điểm đặt cách nhau $r$\n\\frac{kq_1q_2}{r^2}\nLực tương tác là",
    );
    expect(questions[1]).toMatchObject({ answer: "1,0.10^4" });
    expect(problems).toContainEqual(
      expect.objectContaining({ index: 2, severity: "error" }),
    );
  });

  it("keeps image-only stems and gives text-less tf groups a lead-in", () => {
    const img =
      '[img src="https://x.supabase.co/storage/v1/object/public/lesson-images/lesson-1.jpg"]';
    const { questions, problems } = normalizeV1Questions([
      {
        type: "abcd",
        question: img,
        options: [{ text: "Hình 1." }, { text: "Hình 2." }],
        correct: "B",
      },
      {
        type: "truefalse",
        question: `${img}\n[0.8 pts]`,
        options: [{ text: "a" }, { text: "b" }],
        correct: [true, false],
      },
      {
        type: "truefalse",
        question: "",
        options: [{ text: "a" }, { text: "b" }],
        correct: [false, true],
      },
    ]);
    expect(QuestionsSchema.safeParse(questions).success).toBe(true);
    expect(questions.map((q) => [q.stem, q.image?.path])).toEqual([
      ["", "legacy/lesson-1.jpg"],
      ["", "legacy/lesson-1.jpg"],
      [TF_DEFAULT_STEM, undefined],
    ]);
    expect(problems).toEqual([
      expect.objectContaining({ index: 2, severity: "warning" }),
    ]);
  });

  it("keeps extra images inline instead of dropping them", () => {
    const url = (n: number) =>
      `https://x.supabase.co/storage/v1/object/public/lesson-images/lesson-${n}.jpg`;
    const { questions, problems } = normalizeV1Questions([
      {
        type: "number",
        question: `Cho hình [img src="${url(1)}"] và [img src="${url(2)}"]`,
        correct: "3",
      },
    ]);
    expect(problems).toEqual([]);
    expect(questions[0]).toMatchObject({
      stem: "Cho hình và ![](media:legacy/lesson-2.jpg)",
      image: { path: "legacy/lesson-1.jpg" },
    });
    const text = serializeLesson(questions);
    expect(parseLessonText(text, { previous: questions }).questions).toEqual(
      questions,
    );
  });

  it("reports a non-array", () => {
    expect(normalizeV1Questions(null).problems).toHaveLength(1);
  });

  it("warns about images it can't migrate and out-of-range points", () => {
    const { questions, problems } = normalizeV1Questions(
      [
        {
          type: "number",
          question: 'X [img src="https://example.com/a.png"]',
          correct: "1",
          points: 500,
        },
      ],
      defaultV1MediaPath,
    );
    expect(questions[0]).toEqual({
      id: "q_x1",
      type: "short",
      stem: "X",
      answer: "1",
    });
    expect(problems.map((p) => p.message)).toEqual([
      expect.stringContaining("out of range"),
      expect.stringContaining("not migrated"),
    ]);
  });
});

describe("helpers", () => {
  it("maps v1 bucket URLs to safe legacy paths", () => {
    expect(
      defaultV1MediaPath(
        "https://x.supabase.co/storage/v1/object/public/lesson-images/cover%20gk1.png?t=1",
      ),
    ).toBe("legacy/cover-gk1.png");
    expect(
      defaultV1MediaPath(
        "https://x.supabase.co/storage/v1/object/public/lesson-images/Đồ thị (1).png",
      ),
    ).toBe("legacy/Do-thi-1-.png");
    expect(defaultV1MediaPath("https://example.com/a.png")).toBeNull();
    expect(defaultV1MediaPath("data:image/png;base64,AAAA")).toBeNull();
  });

  it("cleans HTML and whitespace", () => {
    expect(cleanLegacyText("  a<br/>  <b>b</b> &amp; c\n\n\n\nd ")).toEqual({
      text: "a\nb & c\n\nd",
      hadHtml: true,
    });
  });

  it("maps config, grade and tags", () => {
    const [gk1, song, dien] = SAMPLE;
    expect(normalizeV1Config(gk1 ?? {}).config).toMatchObject({
      timeLimitSec: 3000,
      shuffleQuestions: true,
      shuffleOptions: true,
      pool: { enabled: false },
      points: { mode: "per-question" },
      examGuard: true,
    });
    expect(normalizeV1Config(song ?? {}).config.pool).toEqual({
      enabled: true,
      byType: { mcq: 2, short: 1 },
    });
    const clamped = normalizeV1Config(dien ?? {});
    expect(clamped.config.timeLimitSec).toBe(60);
    expect(clamped.problems).toHaveLength(1);
    expect(
      normalizeV1Config({ enable_question_pool: true, question_pool_size: 5 })
        .config.pool,
    ).toEqual({ enabled: true, size: 5 });
    expect(normalizeV1Grade("Lớp 11")).toBe(11);
    expect(normalizeV1Grade(12)).toBe(12);
    expect(normalizeV1Grade("9")).toBeNull();
    expect(normalizeV1Tags(["a", " a ", ""])).toEqual(["a"]);
    expect(normalizeV1Tags('["x","y"]')).toEqual(["x", "y"]);
    expect(normalizeV1Tags("điện, lớp 11")).toEqual(["điện", "lớp 11"]);
    expect(normalizeV1Tags(null)).toEqual([]);
  });
});
