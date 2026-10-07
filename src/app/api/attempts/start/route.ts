import { StartAttemptSchema } from "@/features/attempts/schemas";
import { startAttempt } from "@/features/attempts/service";
import { CHANGE_PASSWORD_PATH } from "@/features/auth/core/login-policy";
import { getCurrentUser } from "@/features/auth/queries";
import { openPage, readForm, seeOther, wantsJson } from "@/lib/form-route";
import { measureOperation } from "@/lib/performance.server";
import { getRequestMeta } from "@/lib/request";
import { err, ok } from "@/lib/result";
import { isSameOrigin } from "@/lib/same-origin";

/**
 * "Bắt đầu làm bài" (05 §3): starts or resumes a test, then opens the runner.
 * A route handler rather than a Server Action, see `lib/form-route.ts`.
 */
export async function POST(req: Request) {
  // Parsed before the guard only to know where a plain form returns to.
  const parsed = StartAttemptSchema.safeParse({
    lessonId: (await readForm(req))?.get("lessonId"),
  });
  const back = parsed.success ? `/lessons/${parsed.data.lessonId}` : "/lessons";
  if (!isSameOrigin(req.headers, req.url))
    return openPage(req, err("FORBIDDEN"), back);

  const user = await measureOperation("attempt.start.auth", getCurrentUser);
  if (!user || user.mustChangePassword) {
    if (wantsJson(req)) return openPage(req, err("UNAUTHENTICATED"), back);
    return seeOther(
      user ? CHANGE_PASSWORD_PATH : `/login?next=${encodeURIComponent(back)}`,
    );
  }

  if (!parsed.success) return openPage(req, err("VALIDATION"), back);
  const { ip } = await getRequestMeta();
  const result = await measureOperation("attempt.start", () =>
    startAttempt(user, parsed.data.lessonId, { ip }),
  );
  // No cache tags: nothing shared changes until the attempt is submitted.
  return openPage(
    req,
    result.ok ? ok({ url: `/attempts/${result.data.attemptId}` }) : result,
    back,
  );
}
