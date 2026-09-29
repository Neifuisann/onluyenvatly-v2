import { z } from "zod";
import { getAttemptByLegacyResultId } from "@/features/attempts/queries";
import { requireStudent } from "@/features/auth/guards";
import { errorMessages } from "@/lib/messages";

const LegacyResultIdSchema = z.string().min(1).max(100);

/**
 * v1 `/result/:id` bookmarks (S8-05): the migrated attempt's result page, for
 * its owner or an admin. Anyone else gets the same 404 as a missing id.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/attempts/by-legacy/[legacyResultId]">,
) {
  const user = await requireStudent();
  const parsed = LegacyResultIdSchema.safeParse((await params).legacyResultId);
  const attempt = parsed.success
    ? await getAttemptByLegacyResultId(parsed.data)
    : null;
  const headers = { "Cache-Control": "private, no-store" };
  if (!attempt || (attempt.userId !== user.id && user.role !== "admin"))
    return new Response(errorMessages.NOT_FOUND, { status: 404, headers });
  return new Response(null, {
    status: 308,
    headers: { ...headers, Location: `/attempts/${attempt.id}/result` },
  });
}
