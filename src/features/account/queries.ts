import "server-only";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db/client";
import {
  attempts,
  lessons,
  mistakes,
  ratingEvents,
  ratings,
  sessions,
  users,
} from "@/db/schema";
import { shortUserAgent } from "@/features/students/domain/user-agent";
import { type ExportSource, sessionHandle } from "./domain/account";

/**
 * My own account (S8-04), per request and never shared-cached (05 §4 R).
 * Every read is keyed by the signed-in user's id.
 */

/** What `/settings` shows and edits. */
export async function getMyAccount(userId: string) {
  const [row] = await db
    .select({
      fullName: users.fullName,
      phone: users.phone,
      username: users.username,
      dateOfBirth: users.dateOfBirth,
      grade: users.grade,
      className: users.className,
      avatarPath: users.avatarPath,
      leaderboardInitials: users.leaderboardInitials,
      deletionRequestedAt: users.deletionRequestedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

export type MyAccount = NonNullable<Awaited<ReturnType<typeof getMyAccount>>>;

export type MySession = {
  /** Pass to `revokeMySession`; the full id stays on the server. */
  handle: string;
  current: boolean;
  /** "Chrome · Android", or null when the browser didn't say. */
  device: string | null;
  ip: string | null;
  createdAt: Date;
  lastSeenAt: Date;
};

/** My live sessions, most recently used first; the current one is marked. */
export async function getMySessions(
  userId: string,
  currentSessionId: string,
  now = new Date(),
): Promise<MySession[]> {
  const rows = await db
    .select({
      id: sessions.id,
      ip: sessions.ip,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)))
    .orderBy(desc(sessions.lastSeenAt))
    .limit(20);
  return rows.map((r) => ({
    handle: sessionHandle(r.id),
    current: r.id === currentSessionId,
    device: shortUserAgent(r.userAgent),
    ip: r.ip,
    createdAt: r.createdAt,
    lastSeenAt: r.lastSeenAt,
  }));
}

/**
 * Everything `buildExport` needs (06 §5). Explicit columns only: never the
 * password hash, session ids, items (with points) or per-question marks.
 */
export async function getMyExportSource(
  userId: string,
  now = new Date(),
): Promise<ExportSource | null> {
  const [profile] = await db
    .select({
      fullName: users.fullName,
      phone: users.phone,
      username: users.username,
      dateOfBirth: users.dateOfBirth,
      grade: users.grade,
      className: users.className,
      role: users.role,
      status: users.status,
      avatarPath: users.avatarPath,
      leaderboardInitials: users.leaderboardInitials,
      deletionRequestedAt: users.deletionRequestedAt,
      createdAt: users.createdAt,
      approvedAt: users.approvedAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!profile) return null;
  const [sessionRows, attemptRows, ratingRows, eventRows, mistakeRows] =
    await Promise.all([
      db
        .select({
          createdAt: sessions.createdAt,
          lastSeenAt: sessions.lastSeenAt,
          ip: sessions.ip,
          userAgent: sessions.userAgent,
        })
        .from(sessions)
        .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)))
        .orderBy(desc(sessions.lastSeenAt)),
      db
        .select({
          id: attempts.id,
          lessonTitle: lessons.title,
          mode: attempts.mode,
          status: attempts.status,
          startedAt: attempts.startedAt,
          submittedAt: attempts.submittedAt,
          score: attempts.score,
          maxScore: attempts.maxScore,
          score10: attempts.score10,
          timeTakenSec: attempts.timeTakenSec,
          answers: attempts.answers,
        })
        .from(attempts)
        .leftJoin(lessons, eq(lessons.id, attempts.lessonId))
        .where(eq(attempts.userId, userId))
        .orderBy(desc(attempts.startedAt)),
      db
        .select({
          rating: ratings.rating,
          peak: ratings.peak,
          ratedAttempts: ratings.ratedAttempts,
        })
        .from(ratings)
        .where(eq(ratings.userId, userId))
        .limit(1),
      db
        .select({
          createdAt: ratingEvents.createdAt,
          attemptId: ratingEvents.attemptId,
          before: ratingEvents.before,
          delta: ratingEvents.delta,
          after: ratingEvents.after,
        })
        .from(ratingEvents)
        .where(eq(ratingEvents.userId, userId))
        .orderBy(ratingEvents.createdAt),
      db
        .select({
          lessonTitle: lessons.title,
          questionId: mistakes.questionId,
          questionType: mistakes.questionType,
          wrongCount: mistakes.wrongCount,
          status: mistakes.status,
          updatedAt: mistakes.updatedAt,
        })
        .from(mistakes)
        .leftJoin(lessons, eq(lessons.id, mistakes.lessonId))
        .where(eq(mistakes.userId, userId))
        .orderBy(desc(mistakes.updatedAt)),
    ]);
  return {
    profile,
    sessions: sessionRows,
    attempts: attemptRows,
    rating: ratingRows[0] ?? null,
    ratingEvents: eventRows,
    mistakes: mistakeRows,
  };
}
