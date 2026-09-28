import { z } from "zod";

/**
 * Every environment variable the app reads, validated once (02 §7).
 * There are no fallback secrets in code: a missing required var fails the build/boot.
 *
 * Vars whose feature hasn't been built yet are optional for now. Make each one
 * required in the sprint that starts using it (noted per line).
 */
const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
  VERCEL_GIT_COMMIT_SHA: z.string().optional(),

  DATABASE_URL: z.url().optional(), // required from S1-03
  DATABASE_URL_DIRECT: z.url().optional(), // CI/scripts only
  SUPABASE_URL: z.url().optional(), // required from S5-05
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(), // required from S5-05
  SESSION_PEPPER: z.string().min(32).optional(), // required from S1-04
  GEMINI_API_KEY: z.string().min(1).optional(), // required from S7-01
  GEMINI_MODEL_TEXT: z.string().min(1).optional(),
  GEMINI_MODEL_IMPORT: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(16).optional(), // required from S9-05
  AI_DAILY_BUDGET: z.coerce.number().int().nonnegative().default(0),
});

const clientSchema = z.object({
  NEXT_PUBLIC_MEDIA_BASE_URL: z.url().optional(), // required from S5-05
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

export function parseEnv(source: Record<string, string | undefined>) {
  // Treat empty strings (common in .env files) as "not set".
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, v]) => v !== undefined && v !== ""),
  );
  const result = serverSchema.extend(clientSchema.shape).safeParse(cleaned);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}

// NEXT_PUBLIC_* must be referenced literally so Next can inline them in client bundles.
export const clientEnv: ClientEnv = clientSchema.parse({
  NEXT_PUBLIC_MEDIA_BASE_URL:
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL || undefined,
});
