import "server-only";
import { and, desc, eq, isNull, type SQL, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { attempts, lessons, mistakes } from "@/db/schema";
import {
  type LessonConfig,
  LessonConfigSchema,
  type QuestionType,
} from "@/features/lessons/schema";
import {
  type BankFilters,
  type BankGroup,
  lessonAllowsPractice,
} from "./domain/practice";

/**
 * The mistakes bank (05 §4 `getMistakes`, kind R): per student, never
 * shared-cached. Every read starts from `mistakes_user_status_idx`
 * (`user_id, status, updated_at DESC`); a student has at most a few hundred
 * open mistakes, so the joins to `lessons` are primary-key lookups.
 */

const open = (userId: string) =>
  and(eq(mistakes.userId, userId), eq(mistakes.status, "open"));

const parseConfig = (config: unknown): LessonConfig | null => {
  const parsed = LessonConfigSchema.safeParse(config);
  return parsed.success ? parsed.data : null;
};

const practicable = (config: unknown, now: Date) => {
  const c = parseConfig(config);
  return c !== null && lessonAllowsPractice(c, now);
};

function filtersOf(f: BankFilters): SQL[] {
  return [
    ...(f.chapter ? [eq(lessons.chapter, f.chapter)] : []),
    ...(f.type ? [eq(mistakes.questionType, f.type)] : []),
  ];
}

/** Open mistakes per lesson and type: the filter counts and the start panel. */
export async function getMistakeGroups(
  userId: string,
  now = new Date(),
): Promise<BankGroup[]> {
  const rows = await db
    .select({
      lessonId: mistakes.lessonId,
      chapter: lessons.chapter,
      config: lessons.config,
      questionType: mistakes.questionType,
      count: sql<number>`count(*)::int`,
    })
    .from(mistakes)
    .innerJoin(lessons, eq(lessons.id, mistakes.lessonId))
    .where(open(userId))
    .groupBy(mistakes.lessonId, lessons.id, mistakes.questionType);
  return rows.map((r) => ({
    lessonId: r.lessonId,
    chapter: r.chapter,
    questionType: r.questionType,
    count: Number(r.count),
    practicable: practicable(r.config, now),
  }));
}

export type MistakeRow = {
  lessonId: number;
  lessonTitle: string;
  questionId: string;
  versionId: number;
  questionType: QuestionType | null;
  wrongCount: number;
  updatedAt: Date;
  lastAttemptId: string | null;
  /** The lesson's answers may be shown now, so it can be practised. */
  practicable: boolean;
};

/** Open mistakes, most recent first; one extra row says there are more. */
export async function getMistakes(
  userId: string,
  filters: BankFilters,
  limit: number,
  now = new Date(),
): Promise<{ rows: MistakeRow[]; more: boolean }> {
  const rows = await db
    .select({
      lessonId: mistakes.lessonId,
      lessonTitle: lessons.title,
      config: lessons.config,
      questionId: mistakes.questionId,
      versionId: mistakes.lessonVersionId,
      questionType: mistakes.questionType,
      wrongCount: mistakes.wrongCount,
      updatedAt: mistakes.updatedAt,
      lastAttemptId: mistakes.lastAttemptId,
    })
    .from(mistakes)
    .innerJoin(lessons, eq(lessons.id, mistakes.lessonId))
    .where(and(open(userId), ...filtersOf(filters)))
    .orderBy(desc(mistakes.updatedAt), mistakes.lessonId, mistakes.questionId)
    .limit(limit + 1);
  return {
    rows: rows.slice(0, limit).map(({ config, ...r }) => ({
      ...r,
      practicable: practicable(config, now),
    })),
    more: rows.length > limit,
  };
}

export type PracticeCandidate = {
  lessonId: number;
  questionId: string;
  versionId: number;
  wrongCount: number;
  updatedAt: Date;
};

/** What a new practice set may take: open, matching, answers shown. */
export async function getPracticeCandidates(
  userId: string,
  filters: BankFilters,
  max: number,
  now: Date,
): Promise<PracticeCandidate[]> {
  const rows = await db
    .select({
      lessonId: mistakes.lessonId,
      config: lessons.config,
      questionId: mistakes.questionId,
      versionId: mistakes.lessonVersionId,
      wrongCount: mistakes.wrongCount,
      updatedAt: mistakes.updatedAt,
    })
    .from(mistakes)
    .innerJoin(lessons, eq(lessons.id, mistakes.lessonId))
    .where(and(open(userId), ...filtersOf(filters)))
    .orderBy(desc(mistakes.updatedAt))
    .limit(max);
  return rows.flatMap(({ config, ...r }) =>
    practicable(config, now) ? [r] : [],
  );
}

/** My personalized practice in progress, if any (at most one). */
export async function getOpenReview(userId: string) {
  const [row] = await db
    .select({
      id: attempts.id,
      count: sql<number>`jsonb_array_length(${attempts.items})::int`,
      startedAt: attempts.startedAt,
    })
    .from(attempts)
    .where(
      and(
        eq(attempts.userId, userId),
        eq(attempts.status, "in_progress"),
        isNull(attempts.lessonId),
      ),
    )
    .limit(1);
  return row ? { ...row, count: Number(row.count) } : null;
}
