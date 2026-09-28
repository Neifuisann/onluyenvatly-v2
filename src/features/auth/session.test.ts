import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { resetDb, type TestDb } from "@/test/db";
import { SESSION_RENEW_BELOW_MS } from "./core/session-policy";
import {
  createSession,
  revokeSession,
  revokeUserSessions,
  validateSessionToken,
} from "./session";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());

const DAY = 24 * 60 * 60 * 1000;
const meta = { ip: "1.2.3.4", userAgent: "vitest" };

async function makeUser(status: "active" | "pending" | "disabled" = "active") {
  const [u] = await (db as unknown as TestDb)
    .insert(users)
    .values({
      fullName: "Test",
      phone: `09${Math.random().toString().slice(2, 10)}`,
      passwordHash: "x",
      status,
    })
    .returning({ id: users.id });
  if (!u) throw new Error("insert failed");
  return u.id;
}

beforeEach(async () => {
  await resetDb(db as unknown as TestDb);
});

describe("session lifecycle", () => {
  it("stores only the hash and validates the raw token", async () => {
    const userId = await makeUser();
    const { token, sessionId } = await createSession(userId, meta);
    expect(sessionId).not.toBe(token);
    const [row] = await db.select().from(sessions);
    expect(row?.id).toBe(sessionId);
    expect(row?.ip).toBe("1.2.3.4");

    const user = await validateSessionToken(token);
    expect(user).toMatchObject({ id: userId, role: "student", sessionId });
  });

  it("rejects unknown and malformed tokens", async () => {
    expect(await validateSessionToken("x".repeat(43))).toBeNull();
    expect(await validateSessionToken("garbage")).toBeNull();
  });

  it("rejects users who are no longer active", async () => {
    const userId = await makeUser();
    const { token } = await createSession(userId, meta);
    await db
      .update(users)
      .set({ status: "disabled" })
      .where(eq(users.id, userId));
    expect(await validateSessionToken(token)).toBeNull();
  });

  it("deletes expired sessions", async () => {
    const userId = await makeUser();
    const start = new Date("2026-10-01T00:00:00Z");
    const { token } = await createSession(userId, meta, start);
    expect(
      await validateSessionToken(token, new Date(start.getTime() + 31 * DAY)),
    ).toBeNull();
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it("slides the expiry only when fewer than 15 days remain", async () => {
    const userId = await makeUser();
    const start = new Date("2026-10-01T00:00:00Z");
    const { token, expiresAt } = await createSession(userId, meta, start);

    await validateSessionToken(token, new Date(start.getTime() + 2 * DAY));
    let [row] = await db.select().from(sessions);
    expect(row?.expiresAt.getTime()).toBe(expiresAt.getTime());
    expect(row?.lastSeenAt.getTime()).toBe(start.getTime() + 2 * DAY);

    const late = new Date(expiresAt.getTime() - SESSION_RENEW_BELOW_MS + 1000);
    await validateSessionToken(token, late);
    [row] = await db.select().from(sessions);
    expect(row?.expiresAt.getTime()).toBe(late.getTime() + 30 * DAY);
  });

  it("revokes one session or all of a user's sessions", async () => {
    const userId = await makeUser();
    const a = await createSession(userId, meta);
    const b = await createSession(userId, meta);
    const c = await createSession(userId, meta);

    await revokeSession(a.sessionId);
    expect(await validateSessionToken(a.token)).toBeNull();

    await revokeUserSessions(userId, b.sessionId);
    expect(await validateSessionToken(b.token)).not.toBeNull();
    expect(await validateSessionToken(c.token)).toBeNull();

    await revokeUserSessions(userId);
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it("cascades when the user is deleted", async () => {
    const userId = await makeUser();
    await createSession(userId, meta);
    await db.delete(users).where(eq(users.id, userId));
    expect(await db.select().from(sessions)).toHaveLength(0);
  });
});
