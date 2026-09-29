import { buildExport, exportFileName } from "@/features/account/domain/account";
import { getMyExportSource } from "@/features/account/queries";
import { getCurrentUser } from "@/features/auth/queries";
import { jsonResult } from "@/lib/api-response";
import { vnDateKey } from "@/lib/dates";
import { rateLimit } from "@/lib/rate-limit";
import { err } from "@/lib/result";

/** A few downloads an hour: each one reads every attempt of the user. */
const EXPORT_LIMIT = [5, "1h"] as const;

/**
 * `GET /settings/export` (S8-04, 06 §5 `exportMyData`): my data as a JSON
 * download. The session check answers JSON (401 signed out, 403 while the
 * password must be changed), never a redirect a download would save.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonResult(err("UNAUTHENTICATED"));
  if (user.mustChangePassword) return jsonResult(err("FORBIDDEN"));
  const now = new Date();
  const limit = await rateLimit(
    `account:export:${user.id}`,
    ...EXPORT_LIMIT,
    now,
  );
  if (!limit.ok) return jsonResult(err("RATE_LIMITED"));
  const source = await getMyExportSource(user.id, now);
  if (!source) return jsonResult(err("NOT_FOUND"));
  return new Response(JSON.stringify(buildExport(source, now), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(vnDateKey(now))}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
