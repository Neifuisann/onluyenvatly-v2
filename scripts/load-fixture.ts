/** S9-01. Isolated fixtures; secrets stay in gitignored tmp/load-fixture.json. */
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";
import * as schema from "../src/db/schema.ts";
import { hashPassword } from "../src/features/auth/core/password.ts";
import { hashSessionToken } from "../src/features/auth/core/token.ts";
import {
  DEFAULT_LESSON_CONFIG,
  QuestionsSchema,
} from "../src/features/lessons/schema.ts";

const { values } = parseArgs({
  options: {
    verify: { type: "boolean", default: false },
    performance: { type: "boolean", default: false },
    users: { type: "string", default: "300" },
    "staging-host": { type: "string" },
  },
});
const url = process.env.LOAD_DATABASE_URL;
const pepper = process.env.SESSION_PEPPER;
if (!url || !pepper)
  throw new Error("Set LOAD_DATABASE_URL and SESSION_PEPPER.");
const host = new URL(url).hostname;
if (
  process.env.VERCEL_ENV === "production" ||
  (!["localhost", "127.0.0.1", "::1"].includes(host) &&
    !(host.endsWith(".neon.tech") && host === values["staging-host"]))
)
  throw new Error(
    "Use a local database or explicitly name the Neon staging host.",
  );
const count = z.coerce.number().int().min(1).max(300).parse(values.users);
const manifestSchema = z.object({
  lessonId: z.number(),
  password: z.string(),
  users: z.array(
    z.object({ id: z.uuid(), phone: z.string(), token: z.string() }),
  ),
});
const client = postgres(url, { max: 1, prepare: false });
const db = drizzle({ client, schema });
try {
  if (values.verify) {
    const manifest = manifestSchema.parse(
      JSON.parse(await readFile("tmp/load-fixture.json", "utf8")),
    );
    const ids = manifest.users.slice(0, count).map((u) => u.id);
    const rows = await db
      .select()
      .from(schema.attempts)
      .where(
        and(
          eq(schema.attempts.lessonId, manifest.lessonId),
          inArray(schema.attempts.userId, ids),
        ),
      );
    const events = await db
      .select()
      .from(schema.ratingEvents)
      .where(inArray(schema.ratingEvents.userId, ids));
    const ratings = await db
      .select()
      .from(schema.ratings)
      .where(inArray(schema.ratings.userId, ids));
    const [lesson] = await db
      .select({ attemptCount: schema.lessons.attemptCount })
      .from(schema.lessons)
      .where(eq(schema.lessons.id, manifest.lessonId));
    const failures = rows.filter(
      (a) =>
        a.status !== "submitted" ||
        !a.counterRecorded ||
        a.score !== 7 ||
        a.score10 !== 2.5 ||
        a.maxScore !== 28 ||
        JSON.stringify(a.answers) !==
          JSON.stringify(Array.from({ length: 28 }, (_, i) => "ABCD"[i % 4])),
    );
    const good =
      rows.length === count &&
      new Set(rows.map((a) => a.userId)).size === count &&
      failures.length === 0 &&
      events.length === count &&
      ratings.length === count &&
      lesson?.attemptCount === count &&
      rows.every((a) =>
        events.some((e) => e.attemptId === a.id && e.userId === a.userId),
      ) &&
      ratings.every(
        (r) =>
          r.ratedAttempts === 1 &&
          events.some((e) => e.userId === r.userId && e.after === r.rating),
      );
    const report = {
      ok: good,
      expected: count,
      attempts: rows.length,
      invalid: failures.length,
      ratingEvents: events.length,
      ratings: ratings.length,
      lessonAttemptCount: lesson?.attemptCount ?? null,
    };
    await writeFile(
      "tmp/load-verification.json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
    if (!good) process.exitCode = 1;
  } else {
    const password = randomBytes(24).toString("base64url");
    const passwordHash = await hashPassword(password);
    const questions = QuestionsSchema.parse(
      Array.from({ length: 28 }, (_, i) => ({
        id: `q_load_${i}`,
        type: "mcq",
        stem: `Câu hỏi kiểm tra tải ${i + 1}`,
        options: ["Một", "Hai", "Ba", "Bốn"].map((text) => ({ text })),
        answer: 0,
        points: 1,
      })),
    );
    const manifest = await db.transaction(async (tx) => {
      const [lesson] = await tx
        .insert(schema.lessons)
        .values({
          title: "Kiểm tra tải S9",
          status: "published",
          config: {
            ...DEFAULT_LESSON_CONFIG,
            timeLimitSec: values.performance ? 3600 : 300,
          },
          questionCount: 28,
          typeCounts: { mcq: 28 },
        })
        .returning({ id: schema.lessons.id });
      if (!lesson) throw new Error("No fixture lesson.");
      const [version] = await tx
        .insert(schema.lessonVersions)
        .values({ lessonId: lesson.id, version: 1, sourceText: "", questions })
        .returning({ id: schema.lessonVersions.id });
      if (!version) throw new Error("No fixture version.");
      await tx
        .update(schema.lessons)
        .set({ currentVersionId: version.id })
        .where(eq(schema.lessons.id, lesson.id));
      const run = randomBytes(6).toString("hex");
      const users = [];
      for (let i = 0; i < count; i++) {
        const [user] = await tx
          .insert(schema.users)
          .values({
            username: `load_${run}_${i}`,
            fullName: `Kiểm tra tải ${i + 1}`,
            role: "student",
            status: "active",
            grade: 12,
            passwordHash,
          })
          .returning({ id: schema.users.id, username: schema.users.username });
        if (!user?.username) throw new Error("No fixture user.");
        const token = randomBytes(32).toString("base64url");
        await tx.insert(schema.sessions).values({
          id: hashSessionToken(token, pepper),
          userId: user.id,
          expiresAt: new Date(Date.now() + 3_600_000),
        });
        users.push({ id: user.id, phone: user.username, token });
      }
      return { lessonId: lesson.id, password, users };
    });
    await mkdir("tmp", { recursive: true });
    await writeFile("tmp/load-fixture.json", JSON.stringify(manifest));
    console.log(
      `Created ${count} isolated users; private manifest: tmp/load-fixture.json`,
    );
  }
} catch {
  console.error(
    "Load fixture failed. Check the isolated database and configuration privately.",
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
