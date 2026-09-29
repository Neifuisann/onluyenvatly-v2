"use server";

import { requireStudent } from "@/features/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { err, type Result } from "@/lib/result";
import {
  type VoteResult,
  voteExplanation as voteExplanationService,
} from "./explain-service";
import { VoteInputSchema } from "./schemas";

/**
 * `voteExplanation({ hash, vote })` (05 §2, S7-02): 👍/👎 on an AI
 * explanation, one vote per student, `null` clears it. Explanations are read
 * per request, so there is no cache tag to invalidate.
 */
export async function voteExplanation(
  input: unknown,
): Promise<Result<VoteResult>> {
  const user = await requireStudent();
  const parsed = VoteInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  if (!(await rateLimit(`ai:vote:${user.id}`, 60, "10m")).ok)
    return err("RATE_LIMITED");
  return voteExplanationService(user, parsed.data);
}
