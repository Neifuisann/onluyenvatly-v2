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
  // Host of the production deployment (Vercel sets it on every build), the
  // fallback for SITE_URL.
  VERCEL_PROJECT_PRODUCTION_URL: z.string().min(1).optional(),
  // Public origin for canonical links, the sitemap and OG images (S8-05),
  // e.g. https://onluyenvatly.vn once the domain is set.
  SITE_URL: z.url().optional(),

  DATABASE_URL: z.url(),
  // 5 in production (08). Local PGlite (`pnpm db:local`) needs 1.
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
  DATABASE_URL_DIRECT: z.url().optional(), // CI/scripts only
  // Image uploads (S5-05). Optional so local dev and CI build without them;
  // `createUploadUrl` answers STORAGE_UNAVAILABLE until both are set.
  SUPABASE_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SESSION_PEPPER: z.string().min(32),
  // AI (S7-01). Optional like Storage: without a key or model every AI
  // feature answers AI_UNAVAILABLE. Models may list fallbacks, comma-separated.
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL_TEXT: z.string().min(1).optional(),
  GEMINI_MODEL_IMPORT: z.string().min(1).optional(),
  // Tests only: E2E's Gemini stand-in (tests/e2e/fake-gemini.ts).
  GEMINI_BASE_URL: z.url().optional(),
  CRON_SECRET: z.string().min(16).optional(), // required from S9-05
  SENTRY_DSN: z.url().optional(),
  PERFORMANCE_DIAGNOSTICS: z.enum(["0", "1"]).default("0"),
  AI_DAILY_BUDGET: z.coerce.number().int().nonnegative().default(0),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
  // Public URL of the `media` bucket; images show as their path until set.
  NEXT_PUBLIC_MEDIA_BASE_URL: z.url().optional(),
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

export { clientEnv } from "./env.client";
