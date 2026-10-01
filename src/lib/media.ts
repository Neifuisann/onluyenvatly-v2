import { clientEnv } from "./env.client";

/**
 * Public URL of an object in the Storage `media` bucket (ADR-006), or null
 * when the bucket isn't configured (local dev before S5-05).
 */
export function mediaUrl(
  path: string,
  base: string | undefined = clientEnv.NEXT_PUBLIC_MEDIA_BASE_URL,
): string | null {
  if (!base) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/+$/, "")}/${encoded}`;
}
