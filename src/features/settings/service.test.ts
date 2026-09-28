import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { auditLog, sessions, settings, users } from "@/db/schema";
import { hashPassword } from "@/features/auth/core/password";
import { loginWithPassword, registerStudent } from "@/features/auth/service";
import { resetDb, type TestDb } from "@/test/db";
import { getAdmins } from "./admin-queries";
import { SettingsPatchSchema } from "./domain/settings";
import { getSettings } from "./queries";
import { updateSettings } from "./service";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
// `"use cache"` is a no-op outside Next, so every read sees the latest row
// (in the app, `updateSettings` invalidates the `settings` tag).
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

const tdb = db as unknown as TestDb;
const NOW = new Date("2026-10-01T03:00:00Z");
const PASSWORD = "vatly-2026";
const meta = { ip: null, userAgent: "vitest" };

let admin: { id: string };
let passwordHash: string;

async function addAdmin(username: string, fullName = "Quản Trị") {
  passwordHash ??= await hashPassword(PASSWORD);
  const [row] = await tdb
    .insert(users)
    .values({
      role: "admin",
      status: "active",
      fullName,
      username,
      passwordHash,
    })
    .returning({ id: users.id });
  return row?.id ?? "";
}

/** What the action hands the service: the parsed form. */
const patch = (input: unknown) => SettingsPatchSchema.parse(input);

beforeEach(async () => {
  await resetDb(tdb);
  admin = { id: await addAdmin("admin") };
});

describe("updateSettings", () => {
  it("writes the changed keys with updated_by and audits the keys only", async () => {
    const result = await updateSettings(
      admin,
      patch({
        registrationOpen: true,
        singleSession: false,
        aiEnabled: true,
        aiDailyBudget: 50,
        announcement: "  Thi thử thứ Bảy  ",
      }),
      NOW,
    );
    expect(result).toEqual({
      ok: true,
      data: { changed: ["singleSession", "aiDailyBudget", "announcement"] },
    });
    const [row] = await tdb.select().from(settings);
    expect(row).toMatchObject({
      id: 1,
      registrationOpen: true,
      singleSession: false,
      aiEnabled: true,
      aiDailyBudget: 50,
      announcement: "Thi thử thứ Bảy",
      updatedAt: NOW,
      updatedBy: admin.id,
    });
    const audit = await tdb.select().from(auditLog);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorId: admin.id,
      action: "settings.update",
      targetType: "settings",
      targetId: "1",
      data: { changed: ["singleSession", "aiDailyBudget", "announcement"] },
    });
    // Keys only: the announcement text is not in the audit log.
    expect(JSON.stringify(audit[0]?.data)).not.toContain("Thi thử");
    expect(await getSettings()).toMatchObject({
      singleSession: false,
      announcement: "Thi thử thứ Bảy",
    });
  });

  it("writes and audits nothing when no value changes", async () => {
    const result = await updateSettings(
      admin,
      patch({ registrationOpen: true, announcement: "" }),
      NOW,
    );
    expect(result).toEqual({ ok: true, data: { changed: [] } });
    const [row] = await tdb.select().from(settings);
    expect(row?.updatedBy).toBeNull();
    expect(await tdb.select().from(auditLog)).toHaveLength(0);
  });

  it("clears the announcement", async () => {
    await updateSettings(admin, patch({ announcement: "Có" }), NOW);
    const result = await updateSettings(
      admin,
      patch({ announcement: " " }),
      NOW,
    );
    expect(result).toEqual({ ok: true, data: { changed: ["announcement"] } });
    expect((await getSettings()).announcement).toBeNull();
  });

  it("recreates a missing settings row", async () => {
    await tdb.delete(settings);
    await updateSettings(admin, patch({ aiEnabled: false }), NOW);
    expect(await tdb.select().from(settings)).toMatchObject([
      { id: 1, aiEnabled: false, registrationOpen: true },
    ]);
  });
});

describe("the policy applies on the next login or registration", () => {
  async function addStudent(phone: string) {
    const [row] = await tdb
      .insert(users)
      .values({ fullName: "Học Sinh", phone, status: "active", passwordHash })
      .returning({ id: users.id });
    return row?.id ?? "";
  }
  const login = (identifier: string) =>
    loginWithPassword({ identifier, password: PASSWORD }, meta, NOW);
  const sessionsOf = (id: string) =>
    tdb.select().from(sessions).where(eq(sessions.userId, id));

  it("single session off: a second login keeps the first session", async () => {
    const id = await addStudent("0912345678");
    await login("0912345678");
    await login("0912345678");
    expect(await sessionsOf(id)).toHaveLength(1);

    await updateSettings(admin, patch({ singleSession: false }), NOW);
    await login("0912345678");
    expect(await sessionsOf(id)).toHaveLength(2);

    await updateSettings(admin, patch({ singleSession: true }), NOW);
    await login("0912345678");
    expect(await sessionsOf(id)).toHaveLength(1);
  });

  it("registration closed: a new registration is refused, then allowed again", async () => {
    const register = (phone: string) =>
      registerStudent(
        {
          fullName: "Nguyễn Văn An",
          phone,
          dateOfBirth: "2009-05-17",
          grade: 12,
          className: "12A1",
          password: PASSWORD,
        },
        meta,
        NOW,
      );
    await updateSettings(admin, patch({ registrationOpen: false }), NOW);
    expect(await register("0987654321")).toMatchObject({
      ok: false,
      code: "REGISTRATION_CLOSED",
    });
    expect(
      await tdb.select().from(users).where(eq(users.phone, "0987654321")),
    ).toHaveLength(0);

    await updateSettings(admin, patch({ registrationOpen: true }), NOW);
    expect((await register("0987654321")).ok).toBe(true);
  });
});

describe("getAdmins", () => {
  it("lists admins only, by accent-free name", async () => {
    await addAdmin("zeta", "Đỗ Văn Z");
    await addAdmin("alpha", "An Nguyễn");
    await tdb
      .insert(users)
      .values({ fullName: "Học Sinh", phone: "0911111111", passwordHash });
    const rows = await getAdmins();
    expect(rows.map((r) => r.username)).toEqual(["alpha", "zeta", "admin"]);
    expect(rows[0]).toMatchObject({
      fullName: "An Nguyễn",
      status: "active",
      lastLoginAt: null,
    });
  });
});
