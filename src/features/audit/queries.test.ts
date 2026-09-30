import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { auditLog, users } from "@/db/schema";
import { resetDb, type TestDb } from "@/test/db";
import { AUDIT_PAGE_SIZE } from "./domain/audit-log";
import { auditRowsQuery, getAuditLog } from "./queries";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());

const tdb = db as unknown as TestDb;
const T0 = new Date("2026-09-01T02:00:00Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

let adminId = "";
let studentId = "";

beforeAll(async () => {
  await resetDb(tdb);
  const [admin, student, gone] = await tdb
    .insert(users)
    .values([
      {
        role: "admin",
        status: "active",
        fullName: "Cô Lan",
        username: "lan",
        passwordHash: "x",
      },
      {
        role: "student",
        status: "active",
        fullName: "Minh An",
        phone: "0900000201",
        passwordHash: "x",
      },
      {
        role: "admin",
        status: "active",
        fullName: "Đã nghỉ",
        username: "old",
        passwordHash: "x",
      },
    ])
    .returning({ id: users.id });
  adminId = admin?.id ?? "";
  studentId = student?.id ?? "";
  // 120 lesson entries (two per minute share a timestamp, like one bulk
  // insert), 3 settings/admin entries, 1 student entry, 1 by a deleted admin.
  await tdb.insert(auditLog).values([
    ...Array.from({ length: 120 }, (_, i) => ({
      actorId: adminId,
      action: "lesson.save_draft",
      targetType: "lesson",
      targetId: String(i),
      data: { i },
      createdAt: at(Math.floor(i / 2)),
    })),
    { actorId: adminId, action: "settings.update", createdAt: at(100) },
    { actorId: adminId, action: "admin.create", createdAt: at(101) },
    { actorId: adminId, action: "settings.update", createdAt: at(102) },
    {
      actorId: studentId,
      action: "account.update_profile",
      targetType: "user",
      targetId: studentId,
      createdAt: at(103),
    },
    {
      actorId: gone?.id ?? null,
      action: "student.approve",
      createdAt: at(104),
    },
  ]);
  await tdb.delete(users).where(sql`${users.id} = ${gone?.id ?? ""}`);
  // Statistics for the expression index, as autovacuum keeps them in prod.
  await tdb.execute(sql`analyze audit_log`);
});

describe("getAuditLog", () => {
  it("reads newest first, ties by id, with the actor", async () => {
    const log = await getAuditLog({ area: null, page: 1 });
    expect(log).toMatchObject({
      total: 125,
      capped: false,
      page: 1,
      pageCount: 3,
      offset: 0,
    });
    expect(log.rows).toHaveLength(AUDIT_PAGE_SIZE);
    expect(log.rows.slice(0, 5).map((r) => r.action)).toEqual([
      "student.approve",
      "account.update_profile",
      "settings.update",
      "admin.create",
      "settings.update",
    ]);
    // The deleted admin's entry stays, without a name.
    expect(log.rows[0]).toMatchObject({ actorId: null, actorName: null });
    expect(log.rows[1]).toMatchObject({
      actorName: "Minh An",
      actorRole: "student",
    });
    // Same timestamp: the later id first.
    expect(log.rows[5]?.targetId).toBe("119");
    expect(log.rows[6]?.targetId).toBe("118");
    const times = log.rows.map((r) => r.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("pages without gaps or repeats", async () => {
    const pages = await Promise.all(
      [1, 2, 3].map((page) => getAuditLog({ area: null, page })),
    );
    const ids = pages.flatMap((p) => p.rows.map((r) => r.id));
    expect(ids).toHaveLength(125);
    expect(new Set(ids).size).toBe(125);
    expect(pages[2]?.rows).toHaveLength(25);
  });

  it("filters by area, several prefixes included", async () => {
    const settings = await getAuditLog({ area: "settings", page: 1 });
    expect(settings.total).toBe(3);
    expect(settings.rows.map((r) => r.action)).toEqual([
      "settings.update",
      "admin.create",
      "settings.update",
    ]);
    const lessons = await getAuditLog({ area: "lessons", page: 1 });
    expect(lessons.total).toBe(120);
    expect(lessons.pageCount).toBe(3);
    expect((await getAuditLog({ area: "explanations", page: 1 })).rows).toEqual(
      [],
    );
  });

  it("shows the last page for a stale page number", async () => {
    const log = await getAuditLog({ area: "settings", page: 7 });
    expect(log.page).toBe(1);
    expect(log.rows).toHaveLength(3);
  });

  it("serves one area from the area index, in order", async () => {
    await tdb.execute(sql`set enable_seqscan = off`);
    const plan = await tdb.execute<{ "QUERY PLAN": string }>(
      sql`explain ${auditRowsQuery({ area: "lessons" }, 50)}`,
    );
    await tdb.execute(sql`reset enable_seqscan`);
    const text = plan.rows.map((r) => r["QUERY PLAN"]).join("\n");
    expect(text).toContain("audit_log_area_created_idx");
    expect(text).not.toMatch(/\bSort\b/);
  });

  it("serves every area from the time index", async () => {
    await tdb.execute(sql`set enable_seqscan = off`);
    const plan = await tdb.execute<{ "QUERY PLAN": string }>(
      sql`explain ${auditRowsQuery({ area: null }, 0)}`,
    );
    await tdb.execute(sql`reset enable_seqscan`);
    const text = plan.rows.map((r) => r["QUERY PLAN"]).join("\n");
    expect(text).toMatch(/Index Scan Backward using audit_log_created_at_idx/);
  });
});
