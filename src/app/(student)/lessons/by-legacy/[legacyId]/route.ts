import { requireStudent } from "@/features/auth/guards";
import { LegacyLessonIdSchema } from "@/features/lessons/domain/lesson-params";
import { overviewCopy } from "@/features/lessons/messages";
import { getLessonIdByLegacyId } from "@/features/lessons/queries";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/lessons/by-legacy/[legacyId]">,
) {
  const user = await requireStudent();
  const parsed = LegacyLessonIdSchema.safeParse((await params).legacyId);
  const id = parsed.success
    ? await getLessonIdByLegacyId(parsed.data, user.role === "admin")
    : null;
  // The lookup is shared-cached, but an authenticated response must not be.
  const headers = { "Cache-Control": "private, no-store" };
  if (id === null)
    return new Response(overviewCopy.notFoundTitle, { status: 404, headers });
  return new Response(null, {
    status: 308,
    headers: { ...headers, Location: `/lessons/${id}` },
  });
}
