import { CHANGE_PASSWORD_PATH } from "@/features/auth/core/login-policy";
import { getCurrentUser } from "@/features/auth/queries";
import { startReviewPractice } from "@/features/review/practice-service";
import { StartReviewSchema } from "@/features/review/schemas";
import { openPage, readForm, seeOther, wantsJson } from "@/lib/form-route";
import { getRequestMeta } from "@/lib/request";
import { err, ok } from "@/lib/result";
import { isSameOrigin } from "@/lib/same-origin";

/**
 * "Tạo bài ôn tập" on `/review` (05 `startReviewPractice`, S7-06): a practice
 * set from my open mistakes under the page's filters, then the runner.
 * A route handler rather than a Server Action, see `lib/form-route.ts`.
 */
export async function POST(req: Request) {
  const back = "/review";
  if (!isSameOrigin(req.headers, req.url))
    return openPage(req, err("FORBIDDEN"), back);

  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) {
    if (wantsJson(req)) return openPage(req, err("UNAUTHENTICATED"), back);
    return seeOther(
      user ? CHANGE_PASSWORD_PATH : `/login?next=${encodeURIComponent(back)}`,
    );
  }

  const form = await readForm(req);
  const parsed = StartReviewSchema.safeParse({
    count: form?.get("count"),
    chapter: form?.get("chapter"),
    type: form?.get("type"),
  });
  if (!parsed.success) return openPage(req, err("VALIDATION"), back);
  const { ip } = await getRequestMeta();
  const result = await startReviewPractice(user, parsed.data, { ip });
  // Per-student data only: nothing shared to invalidate.
  return openPage(
    req,
    result.ok ? ok({ url: `/attempts/${result.data.attemptId}` }) : result,
    back,
  );
}
