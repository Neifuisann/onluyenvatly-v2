import { timingSafeEqual } from "node:crypto";
import { runDailyMaintenance } from "@/features/operations/service";
import { env } from "@/lib/env.server";

/**
 * `GET /api/cron/daily` (05 §3), called by Vercel Cron with
 * `Authorization: Bearer ${CRON_SECRET}`. Counts only; no personal data.
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

  const counts = await runDailyMaintenance();
  const ok = counts.failed === 0 && counts.pending === 0;
  console.info(JSON.stringify({ evt: "cron", job: "daily", ok, ...counts }));
  return Response.json(
    { ok, ...counts },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
