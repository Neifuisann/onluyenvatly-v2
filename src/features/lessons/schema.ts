/**
 * JSON contracts for lesson content (04 §3). `lesson_versions.questions` and
 * `lessons.config` are validated with these before they are written.
 *
 * Pure (Zod only) and imported by relative path from scripts run with Node's
 * type stripping, so no path aliases here.
 */
import { z } from "zod";

export const QUESTION_TYPES = ["mcq", "tf", "short"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** "q_" + a short id, stable across edits of the same question (v1 ids like `q_1` are kept). */
export const QuestionIdSchema = z
  .string()
  .regex(/^q_[A-Za-z0-9_-]{1,32}$/, "Mã câu hỏi không hợp lệ.");

const nonBlank = (max: number, message: string) =>
  z
    .string()
    .max(max)
    .refine((s) => s.trim().length > 0, message);

/** An object path inside the `media` bucket: no scheme, no `..`. */
export const MediaPathSchema = z
  .string()
  .max(300)
  .regex(
    /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9/_.-]*$/,
    "Đường dẫn ảnh không hợp lệ.",
  );

export const MediaSchema = z.strictObject({
  path: MediaPathSchema,
  /** Pixel size when known (uploads); lets the page reserve space. */
  w: z.number().int().positive().max(20_000).optional(),
  h: z.number().int().positive().max(20_000).optional(),
  alt: z.string().max(300).optional(),
});
export type Media = z.infer<typeof MediaSchema>;

const base = {
  id: QuestionIdSchema,
  /** Markdown-lite + LaTeX (`$…$`, `$$…$$`). */
  stem: nonBlank(10_000, "Câu hỏi chưa có nội dung."),
  image: MediaSchema.optional(),
  /** Explicit points override (`[2 pts]` in the text format). */
  points: z.number().positive().max(100).optional(),
  /** Teacher-written, shown only after submit. */
  explanation: z.string().max(20_000).optional(),
};

export const McqOptionSchema = z
  .strictObject({
    text: z.string().max(5_000),
    image: MediaSchema.optional(),
  })
  .refine((o) => o.text.trim().length > 0 || o.image, {
    message: "Phương án chưa có nội dung.",
  });

export const McqQuestionSchema = z
  .strictObject({
    ...base,
    type: z.literal("mcq"),
    options: z.array(McqOptionSchema).min(2).max(6),
    /** Index into `options`. */
    answer: z.number().int().min(0),
  })
  .refine((q) => q.answer < q.options.length, {
    message: "Đáp án đúng không nằm trong các phương án.",
    path: ["answer"],
  });

export const TfStatementSchema = z.strictObject({
  text: nonBlank(5_000, "Mệnh đề chưa có nội dung."),
  answer: z.boolean(),
});

export const TfQuestionSchema = z.strictObject({
  ...base,
  type: z.literal("tf"),
  /** Usually 4 (a–d), kept in order. */
  statements: z.array(TfStatementSchema).min(2).max(8),
});

export const ShortQuestionSchema = z.strictObject({
  ...base,
  type: z.literal("short"),
  /** Canonical, `.` decimal separator, e.g. "1.5". */
  answer: nonBlank(100, "Câu trả lời ngắn chưa có đáp án."),
  /** Absolute tolerance, default 0. */
  tolerance: z.number().min(0).max(1e9).optional(),
});

export const QuestionSchema = z.discriminatedUnion("type", [
  McqQuestionSchema,
  TfQuestionSchema,
  ShortQuestionSchema,
]);

export type McqQuestion = z.infer<typeof McqQuestionSchema>;
export type TfQuestion = z.infer<typeof TfQuestionSchema>;
export type ShortQuestion = z.infer<typeof ShortQuestionSchema>;
export type Question = z.infer<typeof QuestionSchema>;

export const MAX_QUESTIONS = 200;

/** A lesson version's `questions`: 1–200 questions with unique ids. */
export const QuestionsSchema = z
  .array(QuestionSchema)
  .min(1, "Bài chưa có câu hỏi nào.")
  .max(MAX_QUESTIONS)
  .superRefine((qs, ctx) => {
    const seen = new Set<string>();
    qs.forEach((q, i) => {
      if (seen.has(q.id))
        ctx.addIssue({
          code: "custom",
          message: `Mã câu hỏi bị trùng: ${q.id}.`,
          path: [i, "id"],
        });
      seen.add(q.id);
    });
  });

const typeCount = z.number().int().min(0).max(MAX_QUESTIONS);
const typePoints = z.number().min(0).max(100);

export const LessonConfigSchema = z
  .strictObject({
    /** null = no limit. */
    timeLimitSec: z
      .number()
      .int()
      .min(60)
      .max(6 * 3600)
      .nullable(),
    shuffleQuestions: z.boolean(),
    /** mcq options only; tf statements keep a–d order. */
    shuffleOptions: z.boolean(),
    pool: z.strictObject({
      enabled: z.boolean(),
      size: z.number().int().positive().max(MAX_QUESTIONS).optional(),
      byType: z
        .strictObject({
          mcq: typeCount.optional(),
          tf: typeCount.optional(),
          short: typeCount.optional(),
        })
        .optional(),
    }),
    points: z.discriminatedUnion("mode", [
      z.strictObject({ mode: z.literal("per-question") }),
      z.strictObject({
        mode: z.literal("per-type-total"),
        mcq: typePoints.optional(),
        tf: typePoints.optional(),
        short: typePoints.optional(),
      }),
    ]),
    maxAttempts: z.number().int().positive().max(100).nullable(),
    revealAnswers: z.enum(["after_submit", "after_deadline", "never"]),
    countsForRating: z.boolean(),
    /** Copy-block + blur tracking during the test. */
    examGuard: z.boolean(),
    tfScoring: z.enum(["thpt2025", "proportional"]),
  })
  .refine(
    (c) =>
      !c.pool.enabled ||
      c.pool.size !== undefined ||
      Object.values(c.pool.byType ?? {}).some((n) => (n ?? 0) > 0),
    {
      message:
        "Bật bộ câu hỏi ngẫu nhiên thì cần số câu hoặc số câu theo loại.",
      path: ["pool"],
    },
  );
export type LessonConfig = z.infer<typeof LessonConfigSchema>;

/** Defaults match v1 behaviour (04 §3.2). */
export const DEFAULT_LESSON_CONFIG: LessonConfig = {
  timeLimitSec: null,
  shuffleQuestions: false,
  shuffleOptions: false,
  pool: { enabled: false },
  points: { mode: "per-question" },
  maxAttempts: null,
  revealAnswers: "after_submit",
  countsForRating: true,
  examGuard: false,
  tfScoring: "thpt2025",
};
