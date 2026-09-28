import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db/client";
import { env } from "@/lib/env.server";

// Pinged by UptimeRobot every 5 min (12 §5). The `select 1` also keeps the
// Supabase project from pausing.
export async function GET() {
  await connection();
  let dbOk = true;
  try {
    await db.execute(sql`select 1`);
  } catch {
    dbOk = false;
  }
  return Response.json(
    {
      status: dbOk ? "ok" : "degraded",
      db: dbOk ? "ok" : "down",
      env: env.VERCEL_ENV ?? env.NODE_ENV,
      commit: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      time: new Date().toISOString(),
    },
    { status: dbOk ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
