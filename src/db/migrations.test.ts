import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, describe, expect, it } from "vitest";
import * as schema from "./schema";

/**
 * Migration 0017 (B-03) on a v2 database as it was before classes: lessons
 * get an owner, students waiting for approval can log in, and every student
 * keeps seeing every lesson through one class per lesson owner.
 */

const source = join(process.cwd(), "src", "db", "migrations");
const before = mkdtempSync(join(tmpdir(), "ovl-migrations-"));

afterAll(() => rmSync(before, { recursive: true, force: true }));

/** The migrations folder without its last entry (0017). */
function migrationsBefore0017() {
  cpSync(source, before, { recursive: true });
  const journalPath = join(before, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
    entries: { tag: string }[];
  };
  journal.entries = journal.entries.filter((e) => e.tag !== "0017_classes");
  writeFileSync(journalPath, JSON.stringify(journal));
  return before;
}

describe("migration 0017_classes", () => {
  it("backfills owners, activates pending students and opens a class per owner", async () => {
    const client = new PGlite({ extensions: { pg_trgm, unaccent } });
    const db = drizzle({ client, schema });
    await migrate(db, { migrationsFolder: migrationsBefore0017() });

    // Raw SQL: the 0016 schema has no owner_id, so the Drizzle table can't insert.
    await client.exec(`
      insert into users (id, role, status, full_name, username, password_hash, created_at)
        values ('00000000-0000-4000-8000-0000000000a1', 'admin', 'active', 'Cô giáo', 'co', 'x', '2026-01-01'),
               ('00000000-0000-4000-8000-0000000000a2', 'admin', 'active', 'Thầy phụ', 'thay', 'x', '2026-02-01');
      insert into users (id, role, status, full_name, phone, password_hash)
        values ('00000000-0000-4000-8000-0000000000b1', 'student', 'active', 'An', '0911111111', 'x'),
               ('00000000-0000-4000-8000-0000000000b2', 'student', 'pending', 'Bình', '0922222222', 'x'),
               ('00000000-0000-4000-8000-0000000000b3', 'student', 'rejected', 'Cường', '0933333333', 'x');
      insert into lessons (title, status, config, created_by)
        values ('Migrated', 'published', '{}', null),
               ('By helper', 'published', '{}', '00000000-0000-4000-8000-0000000000a2'),
               ('Deleted', 'archived', '{}', null);
      update lessons set deleted_at = now() where title = 'Deleted';
    `);

    await migrate(db, { migrationsFolder: source });

    const owners = await db
      .select({ title: schema.lessons.title, ownerId: schema.lessons.ownerId })
      .from(schema.lessons)
      .orderBy(asc(schema.lessons.id));
    expect(owners).toEqual([
      { title: "Migrated", ownerId: "00000000-0000-4000-8000-0000000000a1" },
      { title: "By helper", ownerId: "00000000-0000-4000-8000-0000000000a2" },
      { title: "Deleted", ownerId: "00000000-0000-4000-8000-0000000000a1" },
    ]);

    const statuses = await db
      .select({ name: schema.users.fullName, status: schema.users.status })
      .from(schema.users)
      .where(eq(schema.users.role, "student"))
      .orderBy(asc(schema.users.fullName));
    expect(statuses).toEqual([
      { name: "An", status: "active" },
      { name: "Bình", status: "active" },
      { name: "Cường", status: "rejected" },
    ]);

    const classes = await db
      .select({
        id: schema.classes.id,
        ownerId: schema.classes.ownerId,
        name: schema.classes.name,
        subject: schema.classes.subject,
      })
      .from(schema.classes)
      .orderBy(asc(schema.classes.ownerId));
    expect(classes.map((c) => [c.ownerId, c.name, c.subject])).toEqual([
      ["00000000-0000-4000-8000-0000000000a1", "Lớp Vật lý", "physics"],
      ["00000000-0000-4000-8000-0000000000a2", "Lớp Vật lý", "physics"],
    ]);
    for (const c of classes) {
      const members = await db
        .select({ userId: schema.classMembers.userId })
        .from(schema.classMembers)
        .where(eq(schema.classMembers.classId, c.id));
      expect(members.map((m) => m.userId).sort()).toEqual([
        "00000000-0000-4000-8000-0000000000b1",
        "00000000-0000-4000-8000-0000000000b2",
      ]);
      const given = await db
        .select({ title: schema.lessons.title })
        .from(schema.classLessons)
        .innerJoin(
          schema.lessons,
          eq(schema.lessons.id, schema.classLessons.lessonId),
        )
        .where(eq(schema.classLessons.classId, c.id));
      // The deleted lesson is not given to anyone.
      expect(given.map((g) => g.title)).toEqual(
        c.ownerId.endsWith("a1") ? ["Migrated"] : ["By helper"],
      );
    }
    await client.close();
  });
});
