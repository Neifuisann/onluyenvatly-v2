/** S9-05. Read-only snapshot; counts and table sizes, never row contents. */
import { mkdir, writeFile } from "node:fs/promises";
import postgres from "postgres";
import { z } from "zod";
import {
  type QuotaMetric,
  quotaWarnings,
} from "../src/features/operations/domain/quotas.ts";
import { vnDateKey } from "../src/lib/dates.ts";

const url = process.env.DATABASE_URL_DIRECT;
if (!url) throw new Error("Set DATABASE_URL_DIRECT.");
const client = postgres(url, { max: 1, prepare: false });
try {
  const day = vnDateKey(new Date());
  const snapshot = await client.begin("read only", async (tx) => {
    const [db] =
      await tx`select pg_database_size(current_database())::float8 bytes`;
    const [{ exists } = {}] =
      await tx`select to_regclass('storage.objects') is not null as exists`;
    const [storage] = exists
      ? await tx`select coalesce(sum((metadata->>'size')::bigint),0)::float8 bytes from storage.objects`
      : await tx`select coalesce(sum(bytes),0)::float8 bytes from media`;
    const [activity] = await tx`select
      (select count(*)::int from attempts where submitted_at >= ${`${day}T00:00:00+07:00`}::timestamptz) attempts_today,
      coalesce((select count from rate_limits where key = ${`ai:global:${day}`}),0)::int ai_calls_today`;
    const tables =
      await tx`select relname as table_name, pg_total_relation_size(relid)::float8 bytes
      from pg_stat_user_tables where schemaname = 'public' order by bytes desc`;
    return {
      dbBytes: Number(db?.bytes),
      storageBytes: Number(storage?.bytes),
      storageSource: exists ? "storage.objects" : "registered-media-only",
      attempts_today: Number(activity?.attempts_today ?? 0),
      ai_calls_today: Number(activity?.ai_calls_today ?? 0),
      tables,
    };
  });
  const metrics: QuotaMetric[] = [
    {
      name: "database_bytes",
      used: snapshot.dbBytes,
      limit: 500 * 1024 * 1024,
    },
    {
      name: "storage_bytes",
      used: snapshot.storageBytes,
      limit: 1024 * 1024 * 1024,
    },
  ];
  if (process.env.QUOTA_AI_DAILY_LIMIT)
    metrics.push({
      name: "ai_calls_today",
      used: Number(snapshot.ai_calls_today),
      limit: z.coerce
        .number()
        .int()
        .positive()
        .parse(process.env.QUOTA_AI_DAILY_LIMIT),
    });
  const warnings = quotaWarnings(metrics);
  await mkdir("tmp", { recursive: true });
  await writeFile(
    "tmp/quota-snapshot.json",
    JSON.stringify({ day, snapshot, metrics, warnings }, null, 2),
  );
  const lines = warnings.map(
    (m) =>
      `- ${m.name}: ${m.used} / ${m.limit} (${Math.round((100 * m.used) / m.limit)}%)`,
  );
  const alert = process.argv.includes("--test-alert") || warnings.length > 0;
  await writeFile(
    "tmp/quota-alert.md",
    alert
      ? `Automated quota check for ${day}.\n\n${lines.length ? lines.join("\n") : "Test alert: no budget was exceeded."}\n\nSee the workflow's count-only snapshot. Vercel usage/egress requires the provider's dashboard alerts.\n`
      : "",
  );
  console.log(
    JSON.stringify({
      day,
      metrics,
      warnings: warnings.length,
      storageSource: snapshot.storageSource,
    }),
  );
} catch {
  console.error(
    "Quota snapshot failed. Check the database configuration privately.",
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
