import { getCurrentUser } from "@/features/auth/queries";
import {
  GameAnswerSchema,
  MAX_ANSWER_BYTES,
  RoomIdSchema,
} from "@/features/games/schemas";
import { answerQuestion } from "@/features/games/service";
import { jsonResult, readJsonBody } from "@/lib/api-response";
import { err } from "@/lib/result";
import { isSameOrigin } from "@/lib/same-origin";

/**
 * One race answer (B-05): graded and timed on the server, idempotent per
 * question. The response carries the key for that question only, the new
 * score and the standings, so players never poll during the race.
 */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/games/[id]/answer">,
) {
  if (!isSameOrigin(req.headers, req.url)) return jsonResult(err("FORBIDDEN"));
  const user = await getCurrentUser();
  if (!user) return jsonResult(err("UNAUTHENTICATED"));

  const id = RoomIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return jsonResult(err("NOT_FOUND"));
  const body = await readJsonBody(req, MAX_ANSWER_BYTES);
  if (!body.ok) return jsonResult(body);
  const input = GameAnswerSchema.safeParse(body.data);
  if (!input.success) return jsonResult(err("VALIDATION"));

  return jsonResult(await answerQuestion(user.id, id.data, input.data));
}
