import { z } from "zod";
import { IMPORT_PATH_PATTERN } from "@/features/ai/domain/import";
import { SOLVE_MAX_TEXT } from "@/features/ai/domain/solve";
import { solveImport } from "@/features/ai/solve-service";
import { getCurrentUser } from "@/features/auth/queries";
import { jsonResult, readJsonBody } from "@/lib/api-response";
import { err } from "@/lib/result";
import { isSameOrigin } from "@/lib/same-origin";

/** The solver's deadline is 240 s (09 AI8); Vercel allows 300. */
export const maxDuration = 300;

const SolveInputSchema = z.strictObject({
  text: z.string().min(1).max(SOLVE_MAX_TEXT),
  path: z.string().regex(IMPORT_PATH_PATTERN).optional(),
});

/**
 * `POST /api/ai/solve` `{ text, path? }` (05 §3, 09 AI8): teachers and
 * admins. Answers the questions in an imported lesson text that have no
 * answer yet, looking at the uploaded file `path` for figures; returns
 * `Result<{ text, filled }>` JSON.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req.headers, req.url)) return jsonResult(err("FORBIDDEN"));
  const user = await getCurrentUser();
  if (!user) return jsonResult(err("UNAUTHENTICATED"));
  if (user.role === "student" || user.mustChangePassword)
    return jsonResult(err("FORBIDDEN"));

  // UTF-8 Vietnamese is up to 3 bytes a character, plus JSON escaping.
  const body = await readJsonBody(req, SOLVE_MAX_TEXT * 4);
  if (!body.ok) return jsonResult(body);
  const input = SolveInputSchema.safeParse(body.data);
  if (!input.success) return jsonResult(err("VALIDATION"));

  return jsonResult(await solveImport(user, input.data));
}
