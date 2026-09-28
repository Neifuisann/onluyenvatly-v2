import "server-only";
import { env } from "@/lib/env.server";

/**
 * Supabase Storage REST calls (ADR-006). Only this module holds the service
 * key; the browser gets a signed URL for one object and uploads the bytes
 * itself, so none pass through our functions.
 */

export const MEDIA_BUCKET = "media";

export type StorageConfig = { url: string; serviceKey: string };

export function storageConfig(): StorageConfig | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return {
    url: env.SUPABASE_URL.replace(/\/+$/, ""),
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

const objectPath = (path: string) =>
  path.split("/").map(encodeURIComponent).join("/");

/**
 * A one-time upload URL for `path` (valid 2 hours). The browser PUTs the
 * file there; an existing object is never overwritten.
 */
export async function signUpload(
  config: StorageConfig,
  path: string,
  fetchFn: typeof fetch = fetch,
): Promise<string | null> {
  const res = await fetchFn(
    `${config.url}/storage/v1/object/upload/sign/${MEDIA_BUCKET}/${objectPath(path)}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.serviceKey}`,
        apikey: config.serviceKey,
        "content-type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    },
  ).catch(() => null);
  if (!res?.ok) {
    // Status only: the body may echo request details.
    console.error("storage: sign upload failed:", res?.status ?? "network");
    return null;
  }
  const json = (await res.json().catch(() => null)) as { url?: unknown } | null;
  // `url` is relative to /storage/v1, e.g. /object/upload/sign/media/…?token=…
  if (typeof json?.url !== "string" || !json.url.startsWith("/object/"))
    return null;
  return `${config.url}/storage/v1${json.url}`;
}
