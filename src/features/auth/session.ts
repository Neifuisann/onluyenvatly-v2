import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db, type Executor } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { env } from "@/lib/env.server";
import { checkSession, sessionExpiry } from "./core/session-policy";
import {
  generateSessionToken,
  hashSessionToken,
  isWellFormedToken,
} from "./core/token";

export type SessionMeta = { ip: string | null; userAgent: string | null };

/** What the rest of the app knows about the logged-in user. No secrets. */
export type SessionUser = {
  id: string;
  role: "student" | "admin";
  fullName: string;
  grade: number | null;
  mustChangePassword: boolean;
  sessionId: string;
};

const hash = (token: string) => hashSessionToken(token, env.SESSION_PEPPER);

/** Creates a session row and returns the raw token for the cookie. */
export async function createSession(
  userId: string,
  meta: SessionMeta,
  now = new Date(),
  tx: Executor = db,
): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const sessionId = hash(token);
  const expiresAt = sessionExpiry(now);
  await tx.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
    ip: meta.ip,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
    createdAt: now,
    lastSeenAt: now,
  });
  return { token, sessionId, expiresAt };
}

/**
 * One SELECT (sessions ⋈ users). Deletes expired rows, rejects users who are
 * no longer active, and slides the expiry only when it's due (06 §1).
 */
export async function validateSessionToken(
  token: unknown,
  now = new Date(),
): Promise<SessionUser | null> {
  if (!isWellFormedToken(token)) return null;
  const sessionId = hash(token);
  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      lastSeenAt: sessions.lastSeenAt,
      id: users.id,
      role: users.role,
      status: users.status,
      fullName: users.fullName,
      grade: users.grade,
      mustChangePassword: users.mustChangePassword,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!row) return null;

  const check = checkSession(row, now);
  if (check.kind === "expired") {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }
  if (row.status !== "active") return null;
  if (check.lastSeenAt) {
    await db
      .update(sessions)
      .set({
        lastSeenAt: check.lastSeenAt,
        ...(check.expiresAt && { expiresAt: check.expiresAt }),
      })
      .where(eq(sessions.id, sessionId));
  }
  return {
    id: row.id,
    role: row.role,
    fullName: row.fullName,
    grade: row.grade,
    mustChangePassword: row.mustChangePassword,
    sessionId,
  };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/** Logs the user out everywhere, optionally keeping one session. */
export async function revokeUserSessions(
  userId: string,
  exceptSessionId?: string,
  tx: Executor = db,
): Promise<void> {
  await tx
    .delete(sessions)
    .where(
      exceptSessionId
        ? and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId))
        : eq(sessions.userId, userId),
    );
}
