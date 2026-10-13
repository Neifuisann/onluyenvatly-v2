"use server";

import { redirect } from "next/navigation";
import { requireStudent } from "@/features/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { err, type Result } from "@/lib/result";
import { afterJoinPath, JoinClassSchema, joinPath } from "./domain/invite";
import { classesCopy as M } from "./messages";
import { joinClass as joinClassService } from "./service";

/**
 * "Vào lớp" on `/join/<code>` (B-03): the one class action a student calls,
 * kept apart from the teacher actions (`actions.ts`, all `requireTeacher`).
 * The student asks to join and goes back to the link, which now says the
 * request waits for the teacher (a student already in the class lands on
 * the linked lesson, or the class). Rate limited: codes must not be
 * guessable by trying many.
 * Memberships are never shared-cached, so joining changes no tag.
 */
export async function joinClass(input: unknown): Promise<Result<never>> {
  const user = await requireStudent();
  const parsed = JoinClassSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const limit = await rateLimit(`class-join:${user.id}`, 20, "1h");
  if (!limit.ok) return err("RATE_LIMITED");
  const result = await joinClassService(
    user,
    parsed.data.code,
    parsed.data.lessonId,
  );
  if (!result.ok)
    return result.code === "FORBIDDEN"
      ? err("FORBIDDEN", { message: M.join.staff })
      : result;
  redirect(
    result.data.status === "active"
      ? afterJoinPath(
          result.data.classId,
          parsed.data.lessonId,
          result.data.hasLesson,
        )
      : joinPath(parsed.data.code, parsed.data.lessonId),
  );
}
