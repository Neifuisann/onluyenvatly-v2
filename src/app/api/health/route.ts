import { connection } from "next/server";
import { env } from "@/lib/env.server";

// Pinged by UptimeRobot every 5 min (12 §5). A DB `select 1` is added in S1-03.
export async function GET() {
  await connection();
  return Response.json(
    {
      status: "ok",
      env: env.VERCEL_ENV ?? env.NODE_ENV,
      commit: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
