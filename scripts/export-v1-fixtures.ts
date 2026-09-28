/**
 * S0-05: export anonymized v1 fixtures for parser, grading and rating tests.
 *
 *   V1_DATABASE_URL=postgres://… node scripts/export-v1-fixtures.ts
 *
 * Writes tests/fixtures/v1/{lessons,rating-history,results}.json:
 * - 10 lessons that together cover every question type,
 * - 20 recent rating_history rows,
 * - 50 recent results (preferring the exported lessons).
 * Names, phones, DOB, hashes, IPs and device ids are dropped; student ids become
 * stable pseudonyms (student_001…). Runs in a READ ONLY transaction.
 */
import { mkdir, writeFile } from "node:fs/promises";
import postgres from "postgres";
import {
  anonymize,
  createPseudonymizer,
  findPhoneLikeStrings,
} from "./lib/anonymize.ts";

const url = process.env.V1_DATABASE_URL;
if (!url) {
  console.error("Set V1_DATABASE_URL (v1 Supabase connection string).");
  process.exit(1);
}

const OUT_DIR = "tests/fixtures/v1";
const LESSONS = 10;
const RATING_ROWS = 20;
const RESULTS = 50;

type Row = Record<string, unknown>;
const sql = postgres(url, { max: 1, prepare: false, idle_timeout: 5 });

/** Greedy pick: first cover every question type, then add the largest lessons. */
function pickLessons(
  census: Array<{ id: string; types: string[]; n: number }>,
): string[] {
  const picked: string[] = [];
  const uncovered = new Set(census.flatMap((l) => l.types));
  const pool = [...census];
  while (uncovered.size > 0 && picked.length < LESSONS) {
    pool.sort(
      (a, b) =>
        b.types.filter((t) => uncovered.has(t)).length -
          a.types.filter((t) => uncovered.has(t)).length || b.n - a.n,
    );
    const best = pool.shift();
    if (!best) break;
    picked.push(best.id);
    for (const t of best.types) uncovered.delete(t);
  }
  pool.sort((a, b) => b.n - a.n);
  for (const l of pool) {
    if (picked.length >= LESSONS) break;
    picked.push(l.id);
  }
  return picked;
}

try {
  const data = await sql.begin("read only", async (tx) => {
    const census = await tx<Array<{ id: string; types: string[]; n: number }>>`
      select id::text, array_agg(distinct coalesce(q->>'type', '(missing)')) as types, count(*)::int as n
      from lessons l, jsonb_array_elements(coalesce(l.questions, '[]'::jsonb)) q
      group by l.id`;
    const ids = pickLessons(census);
    const lessons = await tx<Row[]>`
      select * from lessons where id::text in ${tx(ids)} order by id`;
    const ratingHistory = await tx<Row[]>`
      select * from rating_history order by timestamp desc nulls last limit ${RATING_ROWS}`.catch(
      () => tx<Row[]>`select * from rating_history limit ${RATING_ROWS}`,
    );
    const results = await tx<Row[]>`
      select * from results
      order by (lesson_id::text in ${tx(ids)}) desc, "timestamp" desc
      limit ${RESULTS}`;
    return { lessons, ratingHistory, results };
  });

  const pseudo = createPseudonymizer();
  const files = {
    "lessons.json": anonymize(data.lessons, pseudo),
    "rating-history.json": anonymize(data.ratingHistory, pseudo),
    "results.json": anonymize(data.results, pseudo),
  };

  const leaks = Object.entries(files).flatMap(([f, v]) =>
    findPhoneLikeStrings(v).map((p) => `${f}: ${p}`),
  );
  if (leaks.length > 0) {
    console.error(
      `Phone-like strings found; review and scrub before committing:\n${leaks.join("\n")}`,
    );
  }

  await mkdir(OUT_DIR, { recursive: true });
  for (const [name, value] of Object.entries(files)) {
    await writeFile(
      `${OUT_DIR}/${name}`,
      `${JSON.stringify(value, null, 2)}\n`,
    );
    console.log(
      `wrote ${OUT_DIR}/${name} (${(value as unknown[]).length} rows)`,
    );
  }
  if (leaks.length > 0) process.exitCode = 2;
} finally {
  await sql.end();
}
