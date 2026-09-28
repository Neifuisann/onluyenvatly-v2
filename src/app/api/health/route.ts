import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db/client";
import { env } from "@/lib/env.server";
import { pgErrorCode } from "@/lib/pg-error";

// Pinged by UptimeRobot every 5 min (12 §5). The `select 1` also keeps the
// Supabase project from pausing.
export async function GET() {
  await connection();
  let dbOk = true;
  try {
    await db.execute(sql`select 1`);
  } catch (error) {
    dbOk = false;
    // Code only (28P01 bad password, XX000 unknown pooler tenant, ENOTFOUND,
    // CONNECT_TIMEOUT…): the message can echo connection details.
    console.error("health: db check failed:", pgErrorCode(error) ?? "unknown");
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
