import "server-only";
import { env } from "@/lib/env.server";

/**
 * Supabase Storage REST calls (ADR-006). Only this module holds the service
 * key; the browser gets a signed URL for one object and uploads the bytes
 * itself, so none pass through our functions. The server itself only reads
 * and removes AI import files and stores images found in a DOCX (S7-04).
 */

export const MEDIA_BUCKET = "media";
/** Private: exam files waiting for an AI import, deleted after a day (09 §4). */
export const IMPORTS_BUCKET = "imports";
export type Bucket = typeof MEDIA_BUCKET | typeof IMPORTS_BUCKET;

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

const auth = (config: StorageConfig) => ({
  authorization: `Bearer ${config.serviceKey}`,
  apikey: config.serviceKey,
});

/** Status only: the body may echo request details. */
const logFailure = (what: string, res: Response | null) =>
  console.error(`storage: ${what} failed:`, res?.status ?? "network");

/**
 * A one-time upload URL for `path` (valid 2 hours). The browser PUTs the
 * file there; an existing object is never overwritten.
 */
export async function signUpload(
  config: StorageConfig,
  path: string,
  fetchFn: typeof fetch = fetch,
  bucket: Bucket = MEDIA_BUCKET,
): Promise<string | null> {
  const res = await fetchFn(
    `${config.url}/storage/v1/object/upload/sign/${bucket}/${objectPath(path)}`,
    {
      method: "POST",
      headers: { ...auth(config), "content-type": "application/json" },
      body: "{}",
      cache: "no-store",
    },
  ).catch(() => null);
  if (!res?.ok) {
    logFailure("sign upload", res);
    return null;
  }
  const json = (await res.json().catch(() => null)) as { url?: unknown } | null;
  // `url` is relative to /storage/v1, e.g. /object/upload/sign/media/…?token=…
  if (typeof json?.url !== "string" || !json.url.startsWith("/object/"))
    return null;
  return `${config.url}/storage/v1${json.url}`;
}

/** An object's bytes, or null if missing, unreadable or over `maxBytes`. */
export async function downloadObject(
  config: StorageConfig,
  bucket: Bucket,
  path: string,
  maxBytes: number,
  fetchFn: typeof fetch = fetch,
): Promise<Uint8Array | null> {
  const res = await fetchFn(
    `${config.url}/storage/v1/object/${bucket}/${objectPath(path)}`,
    { headers: auth(config), cache: "no-store" },
  ).catch(() => null);
  if (!res?.ok) {
    if (res?.status !== 404 && res?.status !== 400) logFailure("download", res);
    return null;
  }
  if (Number(res.headers.get("content-length") ?? 0) > maxBytes) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  return bytes.byteLength > maxBytes ? null : bytes;
}

/** Stores bytes the server has (never overwrites). */
export async function uploadObject(
  config: StorageConfig,
  bucket: Bucket,
  path: string,
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  const res = await fetchFn(
    `${config.url}/storage/v1/object/${bucket}/${objectPath(path)}`,
    {
      method: "POST",
      headers: {
        ...auth(config),
        "content-type": contentType,
        "cache-control": "max-age=31536000",
        "x-upsert": "false",
      },
      body: bytes,
      cache: "no-store",
    },
  ).catch(() => null);
  if (!res?.ok) logFailure("upload", res);
  return Boolean(res?.ok);
}

export type StoredObject = { name: string; createdAt: Date | null };

/** Files directly inside `folder` (sub-folders are skipped), oldest first. */
export async function listObjects(
  config: StorageConfig,
  bucket: Bucket,
  folder: string,
  fetchFn: typeof fetch = fetch,
): Promise<StoredObject[] | null> {
  const res = await fetchFn(`${config.url}/storage/v1/object/list/${bucket}`, {
    method: "POST",
    headers: { ...auth(config), "content-type": "application/json" },
    body: JSON.stringify({
      prefix: folder,
      limit: 1000,
      offset: 0,
      sortBy: { column: "created_at", order: "asc" },
    }),
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) {
    logFailure("list", res);
    return null;
  }
  const rows = (await res.json().catch(() => null)) as unknown;
  if (!Array.isArray(rows)) return null;
  return rows.flatMap(
    (r: { name?: unknown; id?: unknown; created_at?: unknown }) =>
      // Folders come back with a null id.
      typeof r?.name === "string" && r.id
        ? [
            {
              name: r.name,
              createdAt:
                typeof r.created_at === "string"
                  ? new Date(r.created_at)
                  : null,
            },
          ]
        : [],
  );
}

/** Deletes objects by full path; true when the request succeeded. */
export async function removeObjects(
  config: StorageConfig,
  bucket: Bucket,
  paths: readonly string[],
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  if (paths.length === 0) return true;
  const res = await fetchFn(`${config.url}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: { ...auth(config), "content-type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) logFailure("remove", res);
  return Boolean(res?.ok);
}
