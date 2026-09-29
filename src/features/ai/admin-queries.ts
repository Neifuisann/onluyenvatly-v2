import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
} from "drizzle-orm";
import { db } from "@/db/client";
import { lessons, questionExplanations } from "@/db/schema";
import { getLessonWithAnswers } from "@/features/lessons/queries";
import { FLAG_DOWN_VOTES } from "./domain/explain";
import {
  countPlan,
  type ExplanationCounts,
  type ExplanationPlanRow,
  planRows,
} from "./domain/pregenerate";

/** Admin reads for `/admin/explanations` (S7-03): per request, uncached. */

const explanationColumns = {
  hash: questionExplanations.questionHash,
  contentMd: questionExplanations.contentMd,
  source: questionExplanations.source,
  model: questionExplanations.model,
  votesUp: questionExplanations.votesUp,
  votesDown: questionExplanations.votesDown,
  reviewedAt: questionExplanations.reviewedAt,
  updatedAt: questionExplanations.updatedAt,
};

export type AdminExplanation = {
  hash: string;
  contentMd: string;
  source: "ai" | "teacher";
  model: string | null;
  votesUp: number;
  votesDown: number;
  reviewedAt: Date | null;
  updatedAt: Date;
};

export type ExplanationLessonOption = { id: number; title: string };

/** Lessons with published content, in the teacher's order. */
export async function getExplanationLessons(): Promise<
  ExplanationLessonOption[]
> {
  return db
    .select({ id: lessons.id, title: lessons.title })
    .from(lessons)
    .where(and(isNotNull(lessons.currentVersionId), isNull(lessons.deletedAt)))
    .orderBy(asc(lessons.sortOrder), asc(lessons.id));
}

/** The published version of a lesson with its questions (answers included). */
export async function getPublishedQuestions(lessonId: number) {
  const [lesson] = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      versionId: lessons.currentVersionId,
    })
    .from(lessons)
    .where(and(eq(lessons.id, lessonId), isNull(lessons.deletedAt)))
    .limit(1);
  if (!lesson?.versionId) return null;
  const questions = await getLessonWithAnswers(lesson.id, lesson.versionId);
  return questions ? { lesson, questions } : null;
}

/** Stored explanations for a set of hashes, keyed by hash. */
export async function getExplanationsByHash(
  hashes: readonly string[],
): Promise<Map<string, AdminExplanation>> {
  const unique = [...new Set(hashes)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select(explanationColumns)
    .from(questionExplanations)
    .where(inArray(questionExplanations.questionHash, unique));
  return new Map(rows.map((r) => [r.hash, r]));
}

export type LessonExplanations = {
  lesson: ExplanationLessonOption;
  rows: (ExplanationPlanRow & { explanation: AdminExplanation | null })[];
  counts: ExplanationCounts;
};

/**
 * A lesson's published questions with their explanation: the teacher's
 * (in the lesson), a stored one, or none yet.
 */
export async function getLessonExplanations(
  lessonId: number,
): Promise<LessonExplanations | null> {
  const found = await getPublishedQuestions(lessonId);
  if (!found) return null;
  const plan = planRows(found.questions);
  const stored = await getExplanationsByHash(
    plan.flatMap((r) => (r.hash ? [r.hash] : [])),
  );
  return {
    lesson: { id: found.lesson.id, title: found.lesson.title },
    rows: plan.map((r) => ({
      ...r,
      explanation: r.hash ? (stored.get(r.hash) ?? null) : null,
    })),
    counts: countPlan(plan, new Set(stored.keys())),
  };
}

export type FlaggedExplanation = AdminExplanation & {
  lessonId: number | null;
  lessonTitle: string | null;
  questionId: string;
};

/**
 * The 👎 queue: unreviewed explanations with 3+ down votes, most first
 * (partial index `question_explanations_flagged_idx`).
 */
export async function getFlaggedExplanations(
  limit = 50,
): Promise<FlaggedExplanation[]> {
  return db
    .select({
      ...explanationColumns,
      lessonId: questionExplanations.lessonId,
      lessonTitle: lessons.title,
      questionId: questionExplanations.questionId,
    })
    .from(questionExplanations)
    .leftJoin(lessons, eq(lessons.id, questionExplanations.lessonId))
    .where(
      and(
        isNull(questionExplanations.reviewedAt),
        gte(questionExplanations.votesDown, FLAG_DOWN_VOTES),
      ),
    )
    .orderBy(
      desc(questionExplanations.votesDown),
      asc(questionExplanations.questionHash),
    )
    .limit(limit);
}
