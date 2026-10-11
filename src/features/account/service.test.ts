import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  attempts,
  auditLog,
  lessons,
  lessonVersions,
  media,
  mistakes,
  ratingEvents,
  ratings,
  sessions,
  users,
} from "@/db/schema";
import { hashPassword } from "@/features/auth/core/password";
import {
  getDeletionRequests,
  getStudentDetail,
} from "@/features/students/admin-queries";
import { resetDb, type TestDb } from "@/test/db";
import { buildExport, sessionHandle } from "./domain/account";
import { getMyAccount, getMyExportSource, getMySessions } from "./queries";
import {
  AVATAR_LIMIT,
  cancelDeletion,
  createAvatarUpload,
  DELETION_LIMIT,
  type Me,
  removeAvatar,
  requestDeletion,
  revokeMySession,
  setAvatar,
  setPrivacy,
  updateProfile,
} from "./service";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());

const tdb = db as unknown as TestDb;
const NOW = new Date("2026-10-20T02:00:00Z");
const PASSWORD = "matkhau-hoc-sinh";
const config = { url: "https://proj.supabase.co", serviceKey: "k" };

let me: Me;
let other: Me;

async function addUser(phone: string, role: "student" | "admin" = "student") {
  const [u] = await tdb
    .insert(users)
    .values({
      role,
      status: "active",
      fullName: "Nguyễn Văn An",
      phone,
      dateOfBirth: "2008-05-01",
      grade: 12,
      className: "12A1",
      passwordHash: await hashPassword(PASSWORD),
    })
    .returning({ id: users.id });
  return u?.id ?? "";
}

async function addSession(userId: string, id: string, ua = "Chrome/1 Android") {
  await tdb.insert(sessions).values({
    id,
    userId,
    expiresAt: new Date(NOW.getTime() + 86_400_000),
    userAgent: ua,
    ip: "203.0.113.7",
    createdAt: NOW,
    lastSeenAt: NOW,
  });
}

const audits = async (userId: string) =>
  (await tdb.select().from(auditLog).where(eq(auditLog.actorId, userId))).map(
    (a) => [a.action, a.data],
  );

beforeEach(async () => {
  await resetDb(tdb);
  me = {
    id: await addUser("0911111111"),
    role: "student",
    sessionId: "a".repeat(64),
  };
  other = {
    id: await addUser("0922222222"),
    role: "student",
    sessionId: "c".repeat(64),
  };
  await addSession(me.id, me.sessionId);
  await addSession(me.id, `b${"0".repeat(63)}`, "Safari/1 iPhone");
  await addSession(other.id, other.sessionId);
});

describe("updateProfile", () => {
  it("writes and audits only the changed keys", async () => {
    const result = await updateProfile(
      me,
      {
        fullName: "Nguyễn Văn Bình",
        dateOfBirth: "2008-05-01",
        grade: 11,
        className: "12A1",
      },
      NOW,
    );
    expect(result).toEqual({
      ok: true,
      data: { changed: ["fullName", "grade"] },
    });
    expect(await getMyAccount(me.id)).toMatchObject({
      fullName: "Nguyễn Văn Bình",
      grade: 11,
      className: "12A1",
    });
    expect(await audits(me.id)).toEqual([
      ["account.update_profile", { changed: ["fullName", "grade"] }],
    ]);
    // The other student is untouched.
    expect((await getMyAccount(other.id))?.fullName).toBe("Nguyễn Văn An");
  });

  it("does nothing when nothing changed", async () => {
    const same = {
      fullName: "Nguyễn Văn An",
      dateOfBirth: "2008-05-01",
      grade: 12,
      className: "12A1",
    };
    expect(await updateProfile(me, same, NOW)).toEqual({
      ok: true,
      data: { changed: [] },
    });
    expect(await audits(me.id)).toEqual([]);
  });
});

describe("setPrivacy", () => {
  it("switches initials on and off, reporting real changes only", async () => {
    expect(await setPrivacy(me, { leaderboardInitials: true }, NOW)).toEqual({
      ok: true,
      data: { changed: true },
    });
    expect(await setPrivacy(me, { leaderboardInitials: true }, NOW)).toEqual({
      ok: true,
      data: { changed: false },
    });
    expect((await getMyAccount(me.id))?.leaderboardInitials).toBe(true);
    expect((await getMyAccount(other.id))?.leaderboardInitials).toBe(false);
  });
});

describe("sessions", () => {
  it("lists mine with a handle, the device and the current one marked", async () => {
    const list = await getMySessions(me.id, me.sessionId, NOW);
    expect(list).toHaveLength(2);
    expect(list.find((s) => s.current)).toMatchObject({
      handle: sessionHandle(me.sessionId),
      device: "Chrome · Android",
    });
    expect(JSON.stringify(list)).not.toContain(me.sessionId);
  });

  it("revokes another device of mine, never the current one or a stranger's", async () => {
    const otherDevice = sessionHandle(`b${"0".repeat(63)}`);
    expect(
      await revokeMySession(me, sessionHandle(me.sessionId)),
    ).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    expect(
      await revokeMySession(me, sessionHandle(other.sessionId)),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await revokeMySession(me, "%%%%%%%%%%%%%%%%")).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    expect(await revokeMySession(me, otherDevice)).toEqual({
      ok: true,
      data: { revoked: 1 },
    });
    expect(await getMySessions(me.id, me.sessionId, NOW)).toHaveLength(1);
    expect(await getMySessions(other.id, other.sessionId, NOW)).toHaveLength(1);
  });
});

describe("deletion request", () => {
  it("needs the password, keeps the first date and can be cancelled", async () => {
    expect(await requestDeletion(me, "sai-mat-khau", NOW)).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { password: expect.any(String) },
    });
    expect((await getMyAccount(me.id))?.deletionRequestedAt).toBeNull();

    expect(await requestDeletion(me, PASSWORD, NOW)).toEqual({
      ok: true,
      data: { requestedAt: NOW },
    });
    const later = new Date(NOW.getTime() + 60_000);
    expect(await requestDeletion(me, PASSWORD, later)).toEqual({
      ok: true,
      data: { requestedAt: NOW },
    });
    expect((await getMyAccount(me.id))?.deletionRequestedAt).toEqual(NOW);
    // The teacher sees it (the admin's "Xóa" then completes it, S6-02).
    expect(await getDeletionRequests()).toEqual([
      {
        id: me.id,
        fullName: "Nguyễn Văn An",
        className: "12A1",
        requestedAt: NOW,
      },
    ]);
    expect(
      (await getStudentDetail({ id: me.id, role: "admin" }, me.id))
        ?.deletionRequestedAt,
    ).toEqual(NOW);

    expect(await cancelDeletion(me, later)).toEqual({
      ok: true,
      data: { cancelled: true },
    });
    expect(await cancelDeletion(me, later)).toEqual({
      ok: true,
      data: { cancelled: false },
    });
    expect((await getMyAccount(me.id))?.deletionRequestedAt).toBeNull();
    expect((await audits(me.id)).map(([a]) => a)).toEqual([
      "account.request_deletion",
      "account.cancel_deletion",
    ]);
  });

  it("is for students only and rate-limits password guesses", async () => {
    const admin: Me = {
      id: await addUser("0933333333", "admin"),
      role: "admin",
      sessionId: "x",
    };
    expect(await requestDeletion(admin, PASSWORD, NOW)).toMatchObject({
      code: "FORBIDDEN",
    });
    for (let i = 0; i < DELETION_LIMIT[0]; i++)
      await requestDeletion(other, "sai", NOW);
    expect(await requestDeletion(other, PASSWORD, NOW)).toMatchObject({
      code: "RATE_LIMITED",
    });
  });
});

describe("avatar", () => {
  const req = {
    contentType: "image/webp",
    bytes: 20_000,
    width: 256,
    height: 256,
  } as const;
  const sign = vi.fn(
    async (_c: unknown, path: string) => `https://signed/${path}`,
  );

  it("signs a path in my folder, saves it, and deletes the one it replaces", async () => {
    const first = await createAvatarUpload(me, req, { now: NOW, config, sign });
    if (!first.ok) throw new Error(first.code);
    expect(first.data.path).toMatch(
      new RegExp(`^avatars/${me.id}/[0-9a-f-]{36}\\.webp$`),
    );
    const remove = vi.fn(async () => true);
    expect(await setAvatar(me, first.data.path, { config, remove })).toEqual({
      ok: true,
      data: { avatarPath: first.data.path },
    });
    expect(remove).not.toHaveBeenCalled();

    const second = await createAvatarUpload(me, req, {
      now: NOW,
      config,
      sign,
    });
    if (!second.ok) throw new Error(second.code);
    await setAvatar(me, second.data.path, { config, remove });
    expect(remove).toHaveBeenCalledWith(config, "media", [first.data.path]);
    expect((await getMyAccount(me.id))?.avatarPath).toBe(second.data.path);
    const paths = (await tdb.select({ path: media.path }).from(media)).map(
      (m) => m.path,
    );
    expect(paths).toEqual([second.data.path]);

    expect(await removeAvatar(me, { config, remove })).toEqual({
      ok: true,
      data: { removed: true },
    });
    expect((await getMyAccount(me.id))?.avatarPath).toBeNull();
    expect(await tdb.select().from(media)).toEqual([]);
  });

  it("refuses someone else's path, an unsigned path and missing storage", async () => {
    const theirs = await createAvatarUpload(other, req, {
      now: NOW,
      config,
      sign,
    });
    if (!theirs.ok) throw new Error(theirs.code);
    expect(await setAvatar(me, theirs.data.path, { config })).toMatchObject({
      code: "VALIDATION",
    });
    const unsigned = `avatars/${me.id}/e3b0c442-98fc-4c14-9afb-f4c8996fb924.webp`;
    expect(await setAvatar(me, unsigned, { config })).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(
      await createAvatarUpload(me, req, { now: NOW, config: null, sign }),
    ).toMatchObject({ code: "STORAGE_UNAVAILABLE" });
  });

  it("rate-limits uploads", async () => {
    for (let i = 0; i < AVATAR_LIMIT[0]; i++)
      await createAvatarUpload(me, req, { now: NOW, config, sign });
    expect(
      await createAvatarUpload(me, req, { now: NOW, config, sign }),
    ).toMatchObject({
      code: "RATE_LIMITED",
    });
  });
});

describe("export source", () => {
  it("holds my data and nothing secret or answer-revealing", async () => {
    const [lesson] = await tdb
      .insert(lessons)
      .values({ title: "Dao động", status: "published", config: {} })
      .returning({ id: lessons.id });
    const [version] = await tdb
      .insert(lessonVersions)
      .values({
        lessonId: lesson?.id ?? 0,
        version: 1,
        sourceText: "",
        questions: [],
      })
      .returning({ id: lessonVersions.id });
    const [attempt] = await tdb
      .insert(attempts)
      .values({
        userId: me.id,
        lessonId: lesson?.id ?? null,
        status: "submitted",
        items: [{ q: "q1", p: 1 }],
        answers: ["B"],
        earned: [1],
        score: 1,
        maxScore: 1,
        score10: 10,
        startedAt: NOW,
        submittedAt: NOW,
      })
      .returning({ id: attempts.id });
    await tdb
      .insert(ratings)
      .values({ userId: me.id, rating: 1520, peak: 1520 });
    await tdb.insert(ratingEvents).values({
      userId: me.id,
      attemptId: attempt?.id ?? null,
      before: 1500,
      delta: 20,
      after: 1520,
      formula: "v2",
    });
    await tdb.insert(mistakes).values({
      userId: me.id,
      lessonId: lesson?.id ?? 0,
      questionId: "q9",
      lessonVersionId: version?.id ?? 0,
      wrongCount: 2,
    });

    const source = await getMyExportSource(me.id, NOW);
    if (!source) throw new Error("no source");
    const out = buildExport(source, NOW);
    expect(out.profile).toMatchObject({
      fullName: "Nguyễn Văn An",
      phone: "0911111111",
    });
    expect(out.sessions).toHaveLength(2);
    expect(out.attempts).toEqual([
      expect.objectContaining({
        lessonTitle: "Dao động",
        score10: 10,
        answers: ["B"],
      }),
    ]);
    expect(out.rating).toEqual({ rating: 1520, peak: 1520, ratedAttempts: 0 });
    expect(out.ratingHistory).toEqual([
      expect.objectContaining({ before: 1500, delta: 20, after: 1520 }),
    ]);
    expect(out.mistakes).toEqual([
      expect.objectContaining({
        lessonTitle: "Dao động",
        questionId: "q9",
        wrongCount: 2,
      }),
    ]);
    const json = JSON.stringify(out);
    for (const secret of [
      "passwordHash",
      "$2",
      me.sessionId,
      "earned",
      "items",
      "0922222222",
    ])
      expect(json).not.toContain(secret);
    expect(
      await getMyExportSource("00000000-0000-4000-8000-000000000000"),
    ).toBeNull();
  });
});
