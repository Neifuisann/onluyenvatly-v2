import type { ClientEnv } from "./env";

// Public values are validated by parseEnv at server/build startup. Keeping
// this literal reference separate avoids shipping Zod and the server schema.
export const clientEnv: ClientEnv = {
  NEXT_PUBLIC_MEDIA_BASE_URL:
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL || undefined,
};
