import type { ClientEnv } from "./env";

// Public values are validated by parseEnv at server/build startup. Keeping
// this literal reference separate avoids shipping Zod and the server schema.
export const clientEnv: ClientEnv = {
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  NEXT_PUBLIC_VERCEL_ENV: (process.env.NEXT_PUBLIC_VERCEL_ENV ||
    undefined) as ClientEnv["NEXT_PUBLIC_VERCEL_ENV"],
  NEXT_PUBLIC_MEDIA_BASE_URL:
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL || undefined,
};
