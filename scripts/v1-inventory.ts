/**
 * S0-03 / S0-04: read-only inventory and usage baseline of the v1 database.
 *
 *   V1_DATABASE_URL=postgres://… node scripts/v1-inventory.ts > tmp/v1-inventory.md
 *
 * Only runs SELECTs, inside a READ ONLY transaction. Prints Markdown that goes
 * into docs 04 §6, 10 §2 and 08 §3. Output contains counts only, no personal data.
 */
import postgres from "postgres";

const url = process.env.V1_DATABASE_URL;
if (!url) {
  console.error("Set V1_DATABASE_URL (v1 Supabase connection string).");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false, idle_timeout: 5 });

type Row = Record<string, unknown>;
const queries: Array<[title: string, query: string]> = [
  [
    "Database size",
    "select pg_size_pretty(pg_database_size(current_database())) as size",
  ],
  [
    "Tables (live rows, total size)",
    `select relname as table, n_live_tup as rows, pg_size_pretty(pg_total_relation_size(relid)) as size
     from pg_stat_user_tables order by pg_total_relation_size(relid) desc`,
  ],
  [
    "Students",
    "select count(*) filter (where is_approved) as approved, count(*) as total from students",
  ],
  [
    "Results",
    `select count(*) as total, min("timestamp") as first, max("timestamp") as last,
            count(*) filter (where student_id is null) as without_student
     from results`,
  ],
  [
    "Lessons",
    `select count(*) as total,
            count(*) filter (where questions is null or jsonb_array_length(questions) = 0) as empty,
            round(avg(jsonb_array_length(questions)), 1) as avg_questions,
            max(jsonb_array_length(questions)) as max_questions
     from lessons`,
  ],
  [
    "Question-type census",
    `select coalesce(q->>'type', '(missing)') as type, count(*) as questions, count(distinct l.id) as lessons
     from lessons l, jsonb_array_elements(coalesce(l.questions, '[]'::jsonb)) q
     group by 1 order by 2 desc`,
  ],
  [
    "Questions with HTML in the stem (manual review in migration)",
    `select count(*) as questions from lessons l, jsonb_array_elements(coalesce(l.questions, '[]'::jsonb)) q
     where coalesce(q->>'question', q->>'text', '') ~ '<[a-zA-Z/][^>]*>'`,
  ],
  [
    "Ratings",
    "select count(*) as students, min(rating) as min, round(avg(rating)) as avg, max(rating) as max from ratings",
  ],
  ["Rating history rows", "select count(*) as rows from rating_history"],
  ["Sessions (not migrated)", "select count(*) as rows from session"],
  [
    "Storage: lesson-images bucket",
    `select count(*) as objects, pg_size_pretty(coalesce(sum((metadata->>'size')::bigint), 0)) as size
     from storage.objects where bucket_id = 'lesson-images'`,
  ],
  [
    "Storage: all buckets",
    `select bucket_id, count(*) as objects, pg_size_pretty(coalesce(sum((metadata->>'size')::bigint), 0)) as size
     from storage.objects group by 1 order by 2 desc`,
  ],
  // S0-04 usage baseline
  [
    "Tests submitted per week (last 12 weeks, VN time)",
    `select date_trunc('week', "timestamp"::timestamptz at time zone 'Asia/Ho_Chi_Minh')::date as week,
            count(*) as results, count(distinct student_id) as active_students
     from results where "timestamp"::timestamptz > now() - interval '12 weeks'
     group by 1 order by 1`,
  ],
  [
    "Tests per day (last 30 days): avg / p95 / max",
    `with d as (
       select ("timestamp"::timestamptz at time zone 'Asia/Ho_Chi_Minh')::date as day, count(*) as n
       from results where "timestamp"::timestamptz > now() - interval '30 days' group by 1)
     select round(avg(n), 1) as avg, percentile_disc(0.95) within group (order by n) as p95, max(n) as max from d`,
  ],
  [
    "Busiest hours (last 60 days, VN time)",
    `select extract(hour from "timestamp"::timestamptz at time zone 'Asia/Ho_Chi_Minh') as hour, count(*) as results
     from results where "timestamp"::timestamptz > now() - interval '60 days'
     group by 1 order by 2 desc limit 5`,
  ],
  [
    "Busiest 10-minute windows (last 60 days) — burst size for the load test",
    `select to_char(date_bin('10 minutes', "timestamp"::timestamptz, 'epoch') at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI') as window_vn,
            count(*) as submits
     from results where "timestamp"::timestamptz > now() - interval '60 days'
     group by 1 order by 2 desc limit 5`,
  ],
  [
    "Quiz game usage (last 90 days)",
    `select count(*) as results, count(distinct student_id) as students from quiz_results
     where created_at > now() - interval '90 days'`,
  ],
  [
    "Leftover tables",
    "select (select count(*) from temp_lesson_content) as temp_lesson_content, (select count(*) from ai_interactions) as ai_interactions",
  ],
];

function toMarkdown(rows: Row[]): string {
  if (rows.length === 0) return "_no rows_";
  const cols = Object.keys(rows[0] ?? {});
  const fmt = (v: unknown) =>
    v instanceof Date ? v.toISOString() : v === null ? "" : String(v);
  return [
    `| ${cols.join(" | ")} |`,
    `|${cols.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${cols.map((c) => fmt(r[c])).join(" | ")} |`),
  ].join("\n");
}

console.log(`# v1 inventory (${new Date().toISOString()})\n`);
try {
  await sql.begin("read only", async (tx) => {
    for (const [title, query] of queries) {
      // tx.savepoint (not raw SAVEPOINT) so a failed query (e.g. a table v1 never
      // created) rolls back cleanly instead of leaving postgres.js hanging.
      try {
        const rows = await tx.savepoint((sp) => sp.unsafe<Row[]>(query));
        console.log(`## ${title}\n\n${toMarkdown(rows)}\n`);
      } catch (e) {
        console.log(`## ${title}\n\n_query failed: ${(e as Error).message}_\n`);
      }
    }
  });
} finally {
  await sql.end();
}
