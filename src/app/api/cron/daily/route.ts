import { timingSafeEqual } from "node:crypto";
import { cleanupImports } from "@/features/ai/import-service";
import { env } from "@/lib/env.server";

/**
 * `GET /api/cron/daily` (05 §3), called by Vercel Cron with
 * `Authorization: Bearer ${CRON_SECRET}`. For now it only removes AI import
 * files older than a day (S7-04, 09 §4); S9-05 adds the rest of the daily
 * chores (expiry sweep, pruning, keep-alive, quota snapshot).
 */
export async function GET(req: Request) {
  const secret = env.CRON_SECRET;
  if (!secret)
    return Response.json(
      { ok: false, code: "NOT_CONFIGURED" },
      { status: 503 },
    );
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return Response.json(
      { ok: false, code: "UNAUTHENTICATED" },
      { status: 401 },
    );

  const imports = await cleanupImports();
  console.info(JSON.stringify({ evt: "cron", job: "daily", imports }));
  return Response.json(
    { ok: true, imports },
    { headers: { "Cache-Control": "no-store" } },
  );
}
