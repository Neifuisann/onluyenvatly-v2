/**
 * The editor's "Cài đặt" tab (S5-03): form values ↔ lesson metadata and
 * `LessonConfig`. Pure, so the browser (live messages) and the server action
 * (the real check) run the same rules. Invalid combinations come back as
 * Vietnamese messages per field; nothing invalid reaches the database.
 */
import { z } from "zod";
import {
  DEFAULT_SUBJECT,
  type Subject,
  SubjectSchema,
} from "../../../lib/subjects.ts";
import { settingsCopy as M } from "../messages.ts";
import {
  type LessonConfig,
  LessonConfigSchema,
  QUESTION_TYPES,
  type QuestionType,
} from "../schema.ts";
import type { TypeCounts } from "./summary.ts";

export type PoolMode = "off" | "size" | "byType";

/** Everything as the inputs hold it: text for numbers, "" for "none". */
export type SettingsForm = {
  title: string;
  description: string;
  grade: "" | "10" | "11" | "12";
  /** Subject code (B-03). */
  subject: Subject;
  chapter: string;
  /** Comma-separated. */
  tags: string;
  /** Minutes; "" = no limit. */
  timeLimitMin: string;
  /** "" = unlimited. */
  maxAttempts: string;
  /** `datetime-local` value in Vietnam time; "" = not scheduled. */
  startsAt: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  poolMode: PoolMode;
  poolSize: string;
  poolByType: Record<QuestionType, string>;
  pointsMode: LessonConfig["points"]["mode"];
  /** Totals per type; "" = that type keeps its own points. */
  pointsByType: Record<QuestionType, string>;
  tfScoring: LessonConfig["tfScoring"];
  revealAnswers: LessonConfig["revealAnswers"];
  countsForRating: boolean;
  examGuard: boolean;
};

export type SettingsField =
  | "form"
  | Exclude<keyof SettingsForm, "poolByType" | "pointsByType">
  | `poolByType.${QuestionType}`
  | `pointsByType.${QuestionType}`;

export type LessonMeta = {
  title: string;
  description: string | null;
  grade: number | null;
  /** Stored code; an unknown one (a removed subject) shows as the default. */
  subject: string;
  chapter: string | null;
  tags: string[];
};

export type SettingsResult =
  | { ok: true; meta: LessonMeta; config: LessonConfig }
  | { ok: false; errors: Partial<Record<SettingsField, string>> };

/** Vietnam has no DST: local time is always UTC+7. */
const VN_OFFSET_MS = 7 * 3600_000;

/** ISO instant → `datetime-local` value in Vietnam time. */
export function isoToVnLocal(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t + VN_OFFSET_MS).toISOString().slice(0, 16);
}

/** `datetime-local` value in Vietnam time → ISO with `+07:00`, or null. */
export function vnLocalToIso(local: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/.exec(local.trim());
  if (!m) return null;
  const iso = `${m[1]}T${m[2]}:00+07:00`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

const num = (n: number | undefined | null) =>
  n === undefined || n === null ? "" : String(n).replace(".", ",");

export function toSettingsForm(
  meta: LessonMeta,
  config: LessonConfig,
): SettingsForm {
  const byType = config.pool.byType ?? {};
  const poolMode: PoolMode = !config.pool.enabled
    ? "off"
    : QUESTION_TYPES.some((t) => (byType[t] ?? 0) > 0)
      ? "byType"
      : "size";
  const points = config.points;
  return {
    title: meta.title,
    description: meta.description ?? "",
    grade: meta.grade ? (String(meta.grade) as SettingsForm["grade"]) : "",
    subject: SubjectSchema.catch(DEFAULT_SUBJECT).parse(meta.subject),
    chapter: meta.chapter ?? "",
    tags: meta.tags.join(", "),
    timeLimitMin:
      config.timeLimitSec === null
        ? ""
        : num(Math.round((config.timeLimitSec / 60) * 100) / 100),
    maxAttempts: num(config.maxAttempts),
    startsAt: isoToVnLocal(config.startsAt),
    shuffleQuestions: config.shuffleQuestions,
    shuffleOptions: config.shuffleOptions,
    poolMode,
    poolSize: num(config.pool.size),
    poolByType: {
      mcq: num(byType.mcq),
      tf: num(byType.tf),
      short: num(byType.short),
    },
    pointsMode: points.mode,
    pointsByType:
      points.mode === "per-type-total"
        ? { mcq: num(points.mcq), tf: num(points.tf), short: num(points.short) }
        : { mcq: "", tf: "", short: "" },
    tfScoring: config.tfScoring,
    revealAnswers: config.revealAnswers,
    countsForRating: config.countsForRating,
    examGuard: config.examGuard,
  };
}

/** "0,25" or "0.25" → 0.25; "" → undefined; anything else → NaN. */
function parseNumber(raw: string): number | undefined {
  const s = raw.trim().replace(",", ".");
  if (s === "") return undefined;
  return /^\d+(?:\.\d+)?$/.test(s) ? Number(s) : Number.NaN;
}

const isInt = (n: number) => Number.isInteger(n);

/**
 * Form → metadata + config, or messages per field. `available` is how many
 * questions of each type the content has (the editor's live parse, or the
 * stored version on the server); without it the pool isn't checked against
 * the content.
 */
export function fromSettingsForm(
  f: SettingsForm,
  available?: TypeCounts,
): SettingsResult {
  const errors: Partial<Record<SettingsField, string>> = {};

  const title = f.title.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!title) errors.title = M.errors.titleRequired;
  else if (title.length > 200) errors.title = M.errors.titleTooLong;
  const description = f.description.trim();
  if (description.length > 2000)
    errors.description = M.errors.descriptionTooLong;
  const chapter = f.chapter.replace(/\s+/g, " ").trim();
  if (chapter.length > 100) errors.chapter = M.errors.chapterTooLong;
  const tags = [
    ...new Set(
      f.tags
        .split(",")
        .map((t) => t.normalize("NFC").replace(/\s+/g, " ").trim())
        .filter(Boolean),
    ),
  ];
  if (tags.length > 20 || tags.some((t) => t.length > 50))
    errors.tags = M.errors.tags;

  const minutes = parseNumber(f.timeLimitMin);
  // Decimals are fine: v1 limits were set to the second (45,5 phút).
  if (minutes !== undefined && !(minutes >= 1 && minutes <= 360))
    errors.timeLimitMin = M.errors.timeLimit;

  const maxAttempts = parseNumber(f.maxAttempts);
  if (
    maxAttempts !== undefined &&
    !(isInt(maxAttempts) && maxAttempts >= 1 && maxAttempts <= 100)
  )
    errors.maxAttempts = M.errors.maxAttempts;

  const startsAt = f.startsAt.trim() ? vnLocalToIso(f.startsAt) : null;
  if (f.startsAt.trim() && !startsAt) errors.startsAt = M.errors.startsAt;

  // Pool: one of "total" or "per type", checked against the content.
  const total = available
    ? QUESTION_TYPES.reduce((s, t) => s + available[t], 0)
    : undefined;
  let pool: LessonConfig["pool"] = { enabled: false };
  if (f.poolMode === "size") {
    const size = parseNumber(f.poolSize);
    if (size === undefined || !isInt(size) || size < 1 || size > 200)
      errors.poolSize = M.errors.poolSize;
    else if (total !== undefined && size > total)
      errors.poolSize = M.errors.poolSizeTooBig(total);
    else pool = { enabled: true, size };
  } else if (f.poolMode === "byType") {
    const byType: Partial<Record<QuestionType, number>> = {};
    let any = false;
    for (const t of QUESTION_TYPES) {
      const n = parseNumber(f.poolByType[t]);
      if (n === undefined) continue;
      if (!isInt(n) || n > 200) {
        errors[`poolByType.${t}`] = M.errors.poolCount;
        continue;
      }
      if (available && n > available[t]) {
        errors[`poolByType.${t}`] = M.errors.poolCountTooBig(available[t]);
        continue;
      }
      if (n > 0) {
        byType[t] = n;
        any = true;
      }
    }
    const typeErrors = QUESTION_TYPES.some((t) => errors[`poolByType.${t}`]);
    if (!any && !typeErrors) errors.poolMode = M.errors.poolEmpty;
    else pool = { enabled: true, byType };
  }

  let points: LessonConfig["points"] = { mode: "per-question" };
  if (f.pointsMode === "per-type-total") {
    const totals: Partial<Record<QuestionType, number>> = {};
    for (const t of QUESTION_TYPES) {
      const n = parseNumber(f.pointsByType[t]);
      if (n === undefined) continue;
      // At most 2 decimals: marks are whole cents (04 §4).
      if (
        Number.isNaN(n) ||
        n > 100 ||
        Math.abs(n * 100 - Math.round(n * 100)) > 1e-6
      )
        errors[`pointsByType.${t}`] = M.errors.points;
      else totals[t] = n;
    }
    const typeErrors = QUESTION_TYPES.some((t) => errors[`pointsByType.${t}`]);
    if (Object.keys(totals).length === 0 && !typeErrors)
      errors.pointsMode = M.errors.pointsEmpty;
    points = { mode: "per-type-total", ...totals };
  }

  // A shared exam window needs a start and a length (04 §3.2).
  if (f.revealAnswers === "after_deadline") {
    if (!f.startsAt.trim()) errors.startsAt ??= M.errors.revealNeedsStart;
    if (minutes === undefined)
      errors.timeLimitMin ??= M.errors.revealNeedsLimit;
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  const config = LessonConfigSchema.safeParse({
    timeLimitSec: minutes === undefined ? null : Math.round(minutes * 60),
    shuffleQuestions: f.shuffleQuestions,
    shuffleOptions: f.shuffleOptions,
    pool,
    points,
    maxAttempts: maxAttempts ?? null,
    startsAt,
    revealAnswers: f.revealAnswers,
    countsForRating: f.countsForRating,
    examGuard: f.examGuard,
    tfScoring: f.tfScoring,
  });
  // The checks above cover the schema; this only guards against drift.
  if (!config.success) return { ok: false, errors: { form: M.errors.invalid } };
  return {
    ok: true,
    meta: {
      title,
      description: description || null,
      grade: f.grade ? Number(f.grade) : null,
      subject: f.subject,
      chapter: chapter || null,
      tags,
    },
    config: config.data,
  };
}

const field = (max: number) => z.string().max(max);
const perType = z.strictObject({
  mcq: field(10),
  tf: field(10),
  short: field(10),
});

/** Server boundary: the form's shape; `fromSettingsForm` checks the values. */
export const SettingsFormSchema = z.strictObject({
  title: field(1000),
  description: field(5000),
  grade: z.enum(["", "10", "11", "12"]),
  subject: SubjectSchema,
  chapter: field(500),
  tags: field(2000),
  timeLimitMin: field(20),
  maxAttempts: field(20),
  startsAt: field(40),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  poolMode: z.enum(["off", "size", "byType"]),
  poolSize: field(20),
  poolByType: perType,
  pointsMode: z.enum(["per-question", "per-type-total"]),
  pointsByType: perType,
  tfScoring: z.enum(["thpt2025", "proportional"]),
  revealAnswers: z.enum(["after_submit", "after_deadline", "never"]),
  countsForRating: z.boolean(),
  examGuard: z.boolean(),
}) satisfies z.ZodType<SettingsForm>;
