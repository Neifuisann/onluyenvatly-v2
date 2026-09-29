import { LegacyLessonIdSchema } from "@/features/lessons/domain/lesson-params";
import { getLessonIdByLegacyId } from "@/features/lessons/queries";
import { errorMessages } from "@/lib/messages";

/**
 * v1 `/share/lesson/:id` links (S8-05), public like the share page itself.
 * Only published lessons resolve; the lookup is shared-cached (`lessons`).
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/share/lessons/by-legacy/[legacyId]">,
) {
  const parsed = LegacyLessonIdSchema.safeParse((await params).legacyId);
  const id = parsed.success ? await getLessonIdByLegacyId(parsed.data) : null;
  if (id === null)
    return new Response(errorMessages.NOT_FOUND, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  return new Response(null, {
    status: 308,
    headers: {
      Location: `/share/lessons/${id}`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
