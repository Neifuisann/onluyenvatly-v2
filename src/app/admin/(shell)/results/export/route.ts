import type { NextRequest } from "next/server";
import { getResultsForExport } from "@/features/attempts/admin-queries";
import { exportFilename, resultsCsv } from "@/features/attempts/domain/csv";
import { parseResultsParams } from "@/features/attempts/domain/results";
import { resultsCopy } from "@/features/attempts/messages";
import { getCurrentUser } from "@/features/auth/queries";
import { jsonResult } from "@/lib/api-response";
import { err } from "@/lib/result";

/**
 * `GET /admin/results/export` (S6-04): the results of the page's filters as
 * CSV, up to 10,000 rows, of the teacher's own lessons (B-03). The teacher
 * check comes first and answers JSON (401
 * signed out, 403 otherwise, also for an admin who must change the
 * password), never a redirect a download would follow. No phone or date of
 * birth (06 §5); cells are guarded against formula injection (`toCsv`).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonResult(err("UNAUTHENTICATED"));
  if (user.role === "student" || user.mustChangePassword)
    return jsonResult(err("FORBIDDEN"));

  const filters = parseResultsParams(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  const { rows, truncated } = await getResultsForExport(user, filters);
  const now = new Date();
  return new Response(resultsCsv(rows, resultsCopy.review), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(now)}"`,
      "Cache-Control": "private, no-store",
      // More than 10,000 matches: the file holds the newest 10,000.
      ...(truncated && { "X-Export-Truncated": "true" }),
    },
  });
}
