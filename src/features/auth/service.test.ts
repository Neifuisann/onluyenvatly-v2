import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { sessions, settings, users } from "@/db/schema";
import { resetDb, type TestDb } from "@/test/db";
import { hashPassword } from "./core/password";
import { AUTH_LIMITS, loginWithPassword, registerStudent } from "./service";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
// `"use cache"` is a no-op outside Next; stub the tag helpers.
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

const tdb = db as unknown as TestDb;
const meta = { ip: "203.0.113.7", userAgent: "vitest" };
const PASSWORD = "vatly-2026";
let hash: string;

async function addUser(
  values: Partial<typeof users.$inferInsert> & { phone?: string },
) {
  hash ??= await hashPassword(PASSWORD);
  const [u] = await tdb
    .insert(users)
    .values({
      fullName: "Học Sinh",
      passwordHash: hash,
      status: "active",
      ...values,
    })
    .returning({ id: users.id });
  return u?.id ?? "";
}

const registration = (phone: string) => ({
  fullName: "Nguyễn Văn An",
  phone,
  dateOfBirth: "2009-05-17",
  grade: 12,
  className: "12A1",
  password: PASSWORD,
});

beforeEach(async () => {
  await resetDb(tdb);
});

describe("loginWithPassword", () => {
  it("logs an active student in by phone in any format", async () => {
    const id = await addUser({ phone: "0912345678" });
    const result = await loginWithPassword(
      { identifier: "+84 912 345 678", password: PASSWORD },
      meta,
    );
    expect(result).toMatchObject({ ok: true, data: { role: "student" } });
    const [row] = await tdb.select().from(sessions);
    expect(row?.userId).toBe(id);
    const [user] = await tdb.select().from(users).where(eq(users.id, id));
    expect(user?.lastLoginAt).not.toBeNull();
  });

  it("logs an admin in by username", async () => {
    await addUser({ username: "admin", role: "admin" });
    const result = await loginWithPassword(
      { identifier: "Admin", password: PASSWORD },
      meta,
    );
    expect(result).toMatchObject({ ok: true, data: { role: "admin" } });
  });

  it("gives the same error for an unknown phone and a wrong password", async () => {
    await addUser({ phone: "0912345678" });
    const unknown = await loginWithPassword(
      { identifier: "0987654321", password: PASSWORD },
      meta,
    );
    const wrong = await loginWithPassword(
      { identifier: "0912345678", password: "wrong-pass" },
      meta,
    );
    const garbage = await loginWithPassword(
      { identifier: "!!", password: "x" },
      meta,
    );
    for (const r of [unknown, wrong, garbage])
      expect(r).toMatchObject({ ok: false, code: "INVALID_CREDENTIALS" });
  });

  it("reports pending and rejected accounts only after a correct password", async () => {
    await addUser({ phone: "0911111111", status: "pending" });
    await addUser({ phone: "0922222222", status: "rejected" });
    await addUser({ phone: "0933333333", status: "disabled" });
    const login = (identifier: string, password = PASSWORD) =>
      loginWithPassword({ identifier, password }, meta);

    expect(await login("0911111111", "wrong-pass")).toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    expect(await login("0911111111")).toMatchObject({
      code: "ACCOUNT_PENDING",
    });
    expect(await login("0922222222")).toMatchObject({
      code: "ACCOUNT_REJECTED",
    });
    expect(await login("0933333333")).toMatchObject({
      code: "ACCOUNT_REJECTED",
    });
    expect(await tdb.select().from(sessions)).toHaveLength(0);
  });

  it("keeps one session per user when single_session is on", async () => {
    await addUser({ phone: "0912345678" });
    const login = () =>
      loginWithPassword({ identifier: "0912345678", password: PASSWORD }, meta);
    await login();
    await login();
    expect(await tdb.select().from(sessions)).toHaveLength(1);

    await tdb.update(settings).set({ singleSession: false });
    await login();
    expect(await tdb.select().from(sessions)).toHaveLength(2);
  });
});

describe("login rate limits (06 §4)", () => {
  const [perMinute] = AUTH_LIMITS.loginPerIdentifierMinute;
  const [perHour] = AUTH_LIMITS.loginPerIdentifierHour;
  const [perIp] = AUTH_LIMITS.loginPerIp;

  it(`allows ${perMinute} tries per identifier per minute`, async () => {
    await addUser({ phone: "0912345678" });
    const now = new Date("2026-10-12T08:00:05Z");
    const codes = [];
    for (let i = 0; i <= perMinute; i++) {
      const r = await loginWithPassword(
        { identifier: "0912345678", password: "wrong-pass" },
        { ...meta, ip: `10.0.0.${i}` },
        now,
      );
      codes.push(r.ok ? "OK" : r.code);
    }
    expect(codes.at(-1)).toBe("RATE_LIMITED");
    expect(
      codes.slice(0, perMinute).every((c) => c === "INVALID_CREDENTIALS"),
    ).toBe(true);

    // Even the right password is refused while limited…
    const blocked = await loginWithPassword(
      { identifier: "0912 345 678", password: PASSWORD },
      meta,
      now,
    );
    expect(blocked).toMatchObject({ code: "RATE_LIMITED" });
    // …and works again next minute.
    const later = await loginWithPassword(
      { identifier: "0912345678", password: PASSWORD },
      meta,
      new Date("2026-10-12T08:01:05Z"),
    );
    expect(later.ok).toBe(true);
  });

  it(`allows ${perHour} tries per identifier per hour`, async () => {
    let limited = 0;
    for (let i = 0; i <= perHour; i++) {
      // Spread over minutes so only the hourly limit applies.
      const now = new Date(
        Date.UTC(2026, 9, 12, 8, Math.floor(i / perMinute), 0),
      );
      const r = await loginWithPassword(
        { identifier: "0912345678", password: "x" },
        { ...meta, ip: null },
        now,
      );
      if (!r.ok && r.code === "RATE_LIMITED") limited++;
    }
    expect(limited).toBe(1);
  });

  it(`allows ${perIp} tries per IP per 10 minutes`, async () => {
    const now = new Date("2026-10-12T08:00:05Z");
    const codes = [];
    for (let i = 0; i <= perIp; i++) {
      const r = await loginWithPassword(
        { identifier: `09${String(10_000_000 + i)}`, password: "x" },
        meta,
        now,
      );
      codes.push(r.ok ? "OK" : r.code);
    }
    expect(codes.filter((c) => c === "RATE_LIMITED")).toHaveLength(1);
    expect(codes.at(-1)).toBe("RATE_LIMITED");
  });
});

describe("registerStudent", () => {
  it("creates a pending student", async () => {
    const result = await registerStudent(registration("0912345678"), meta);
    expect(result.ok).toBe(true);
    const [user] = await tdb.select().from(users);
    expect(user).toMatchObject({
      role: "student",
      status: "pending",
      phone: "0912345678",
      grade: 12,
      className: "12A1",
    });
    expect(user?.passwordHash).toMatch(/^\$2[ab]\$10\$/);
  });

  it("rejects a phone that is already registered", async () => {
    await addUser({ phone: "0912345678" });
    const result = await registerStudent(registration("0912345678"), meta);
    expect(result).toMatchObject({
      ok: false,
      code: "CONFLICT",
      fieldErrors: { phone: expect.any(String) },
    });
  });

  it("handles two parallel registrations for one phone", async () => {
    const results = await Promise.all([
      registerStudent(registration("0912345678"), { ...meta, ip: "10.0.0.1" }),
      registerStudent(registration("0912345678"), { ...meta, ip: "10.0.0.2" }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await tdb.select().from(users)).toHaveLength(1);
  });

  it("respects registration_open", async () => {
    await tdb.update(settings).set({ registrationOpen: false });
    const result = await registerStudent(registration("0912345678"), meta);
    expect(result).toMatchObject({ ok: false, code: "REGISTRATION_CLOSED" });
  });

  it(`allows ${AUTH_LIMITS.registerPerIp[0]} registrations per IP per hour`, async () => {
    const now = new Date("2026-10-12T08:00:00Z");
    const codes = [];
    for (let i = 0; i <= AUTH_LIMITS.registerPerIp[0]; i++) {
      const r = await registerStudent(registration(`091234567${i}`), meta, now);
      codes.push(r.ok ? "OK" : r.code);
    }
    expect(codes).toEqual(["OK", "OK", "OK", "RATE_LIMITED"]);
  });
});
