import "server-only";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db/client";
import { attempts, lessons, lessonVersions, users } from "@/db/schema";
import { tags } from "@/lib/cache-tags";
import type { TfScoring } from "../grading/domain/grade";
import {
  computeLessonStats,
  type LessonStats,
  STATS_ATTEMPT_CAP,
  type StatsVersion,
} from "./domain/stats";
import { type Owner, ownedBy } from "./ownership";
import { getLessonWithAnswers } from "./queries";
import type { Question } from "./schema";

/**
 * `/admin/lessons/[id]/stats` (S6-05). The two aggregate reads are shared
 * cached for 5 minutes under `lesson:{id}:stats`: a submit does not
 * invalidate them (the page may lag by up to 5 minutes), deleting an attempt
 * does. Students' submitted attempts only (an admin's own tries are not
 * statistics), served by `attempts_lesson_submitted_idx`.
 */

const FIVE_MINUTES = { stale: 60, revalidate: 300, expire: 600 } as const;

const studentSubmitted = (lessonId: number) =>
  and(
    eq(attempts.lessonId, lessonId),
    eq(attempts.status, "submitted"),
    eq(users.role, "student"),
  );

export type StatsLesson = {
  id: number;
  title: string;
  tfScoring: TfScoring;
  /** The published version, listed in the picker even without attempts. */
  current: Omit<StatsVersion, "attempts"> | null;
};

/**
 * The page header: one primary-key read, per request. It is also the gate
 * of the lesson's stats and results pages: null for another teacher's
 * lesson (B-03).
 */
export async function getStatsLesson(
  owner: Owner,
  id: number,
): Promise<StatsLesson | null> {
  const [row] = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      tfScoring: sql<TfScoring>`coalesce(${lessons.config}->>'tfScoring', 'thpt2025')`,
      currentId: lessonVersions.id,
      currentVersion: lessonVersions.version,
      currentCreatedAt: lessonVersions.createdAt,
    })
    .from(lessons)
    .leftJoin(lessonVersions, eq(lessonVersions.id, lessons.currentVersionId))
    .where(and(eq(lessons.id, id), ownedBy(owner)))
    .limit(1);
  if (!row) return null;
  const { currentId, currentVersion, currentCreatedAt, ...lesson } = row;
  return {
    ...lesson,
    current:
      currentId !== null && currentVersion !== null && currentCreatedAt
        ? {
            id: currentId,
            version: currentVersion,
            createdAt: currentCreatedAt,
          }
        : null,
  };
}

/** Versions with students' submitted attempts (the picker), with counts. */
export async function getStatsVersions(
  lessonId: number,
): Promise<StatsVersion[]> {
  "use cache";
  cacheTag(tags.lessonStats(lessonId));
  cacheLife(FIVE_MINUTES);
  const counted = db
    .select({
      versionId: attempts.lessonVersionId,
      n: count().as("n"),
    })
    .from(attempts)
    .innerJoin(users, eq(users.id, attempts.userId))
    .where(studentSubmitted(lessonId))
    .groupBy(attempts.lessonVersionId)
    .as("counted");
  return db
    .select({
      id: lessonVersions.id,
      version: lessonVersions.version,
      createdAt: lessonVersions.createdAt,
      attempts: sql<number>`${counted.n}::int`,
    })
    .from(counted)
    .innerJoin(lessonVersions, eq(lessonVersions.id, counted.versionId))
    .orderBy(desc(lessonVersions.version));
}

/** A question as the stats page shows it: everything but the explanation. */
export type StatsQuestion = Question extends infer Q
  ? Q extends Question
    ? Omit<Q, "explanation">
    : never
  : never;

export type LessonStatsData = {
  stats: LessonStats;
  questions: StatsQuestion[];
  /** More than `STATS_ATTEMPT_CAP` attempts: only the latest were read. */
  capped: boolean;
};

/**
 * Statistics of one version: its questions WITH ANSWERS (admin page only,
 * never a student route) and the latest 2,000 submitted attempts of
 * students, reduced by the pure `computeLessonStats`. Only the result is
 * cached, not the attempts.
 */
export async function getLessonStats(
  lessonId: number,
  versionId: number,
  tfScoring: TfScoring,
): Promise<LessonStatsData | null> {
  "use cache";
  cacheTag(tags.lessonStats(lessonId));
  cacheLife(FIVE_MINUTES);
  const [questions, rows] = await Promise.all([
    getLessonWithAnswers(lessonId, versionId),
    db
      .select({
        userId: attempts.userId,
        name: users.fullName,
        score10: attempts.score10,
        items: attempts.items,
        answers: attempts.answers,
        earned: attempts.earned,
      })
      .from(attempts)
      .innerJoin(users, eq(users.id, attempts.userId))
      .where(
        and(
          studentSubmitted(lessonId),
          eq(attempts.lessonVersionId, versionId),
        ),
      )
      .orderBy(sql`${attempts.submittedAt} desc nulls last`, desc(attempts.id))
      .limit(STATS_ATTEMPT_CAP + 1),
  ]);
  if (!questions) return null;
  const capped = rows.length > STATS_ATTEMPT_CAP;
  const stats = computeLessonStats(
    questions,
    rows.slice(0, STATS_ATTEMPT_CAP),
    tfScoring,
  );
  return {
    stats,
    questions: questions.map(({ explanation: _, ...q }) => q),
    capped,
  };
}
