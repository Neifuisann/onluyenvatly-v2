/** S9-04: counts and structural sanity only; never prints row contents. */
import { mkdir, writeFile } from "node:fs/promises";
import postgres from "postgres";
import { QuestionsSchema } from "../src/features/lessons/schema.ts";

const url = process.env.RESTORE_DATABASE_URL ?? process.env.DATABASE_URL_DIRECT;
if (!url) throw new Error("Set RESTORE_DATABASE_URL or DATABASE_URL_DIRECT.");
const client = postgres(url, { max: 1, prepare: false });
try {
  if (process.argv.includes("--assert-empty")) {
    const host = new URL(url).hostname;
    if (
      !host.endsWith(".neon.tech") &&
      !["localhost", "127.0.0.1"].includes(host)
    )
      throw new Error(
        "Restore target must be an isolated Neon or local database.",
      );
    for (const name of [
      "DATABASE_URL_DIRECT",
      "NEON_DATABASE_URL",
      "NEON_DATABASE_URL_POOLED",
    ]) {
      const other = process.env[name];
      if (
        other &&
        new URL(other).hostname.replace("-pooler", "") ===
          host.replace("-pooler", "")
      )
        throw new Error(
          "Restore target must not be production or shared staging.",
        );
    }
    const tables =
      await client`select count(*)::int n from information_schema.tables
      where table_schema in ('public', 'drizzle') and table_type = 'BASE TABLE'`;
    if (tables[0]?.n !== 0)
      throw new Error("Restore refuses a nonempty target.");
    console.log("Restore target is isolated and empty.");
  } else {
    const [counts] = await client`select
      (select count(*)::int from users) users,
      (select count(*)::int from lessons) lessons,
      (select count(*)::int from lesson_versions) versions,
      (select count(*)::int from attempts) attempts,
      (select count(*)::int from rating_events) rating_events,
      (select count(*)::int from mistakes) mistakes`;
    const [bad] = await client`select
      (select count(*)::int from attempts where
        jsonb_array_length(items) <> jsonb_array_length(answers) or
        (status = 'submitted' and (score is null or score10 is null or earned is null
          or cardinality(earned) <> jsonb_array_length(items)))) attempts,
      (select count(*)::int from lessons l left join lesson_versions v on v.id = l.current_version_id
        where l.status = 'published' and (v.id is null or v.lesson_id <> l.id)) published,
      (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) rls`;
    let invalidVersions = 0;
    let after = 0;
    for (;;) {
      const rows =
        await client`select id, questions from lesson_versions where id > ${after} order by id limit 200`;
      if (!rows.length) break;
      for (const row of rows)
        if (!QuestionsSchema.safeParse(row.questions).success)
          invalidVersions++;
      after = Number(rows.at(-1)?.id);
    }
    const ok =
      Object.values(bad ?? {}).every((n) => n === 0) && invalidVersions === 0;
    const report = {
      ok,
      counts,
      invalid: { ...bad, versions: invalidVersions },
    };
    await mkdir("tmp", { recursive: true });
    await writeFile(
      "tmp/restore-verification.json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
    if (!ok) process.exitCode = 1;
  }
} catch {
  // Database error messages can contain credentials and row contents.
  console.error(
    "Database verification failed. Check target configuration and schema privately.",
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
