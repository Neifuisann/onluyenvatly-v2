/**
 * Copy v1 images into the v2 Storage `media` bucket (ADR-006) through the
 * Storage REST API. Idempotent: objects already in the bucket are left alone.
 */
import type { MediaJob } from "./migrate-legacy.ts";

export type StorageTarget = {
  /** v2 project URL, e.g. https://xyz.supabase.co */
  url: string;
  serviceKey: string;
  bucket: string;
};

export type CopyResult =
  | { path: string; status: "copied" | "exists"; bytes: number }
  | { path: string; status: "failed"; error: string };

const MAX_BYTES = 10 * 1024 * 1024;
const DATA_URL = /^data:(image\/[a-z+.-]+);base64,(.*)$/is;

type Fetch = typeof fetch;

async function readSource(
  source: string,
  fetchFn: Fetch,
): Promise<{ body: Uint8Array<ArrayBuffer>; contentType: string }> {
  const data = DATA_URL.exec(source);
  if (data)
    return {
      body: Uint8Array.from(Buffer.from(data[2] ?? "", "base64")),
      contentType: (data[1] ?? "image/png").toLowerCase(),
    };
  const res = await fetchFn(source);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const body = new Uint8Array(await res.arrayBuffer());
  return {
    body,
    contentType: res.headers.get("content-type") ?? "application/octet-stream",
  };
}

const objectPath = (path: string) =>
  path.split("/").map(encodeURIComponent).join("/");

export async function copyMediaObject(
  job: MediaJob,
  target: StorageTarget,
  fetchFn: Fetch = fetch,
): Promise<CopyResult> {
  const base = target.url.replace(/\/+$/, "");
  const publicUrl = `${base}/storage/v1/object/public/${target.bucket}/${objectPath(job.path)}`;
  try {
    const head = await fetchFn(publicUrl, { method: "HEAD" });
    if (head.ok)
      return {
        path: job.path,
        status: "exists",
        bytes: Number(head.headers.get("content-length") ?? 0),
      };

    const { body, contentType } = await readSource(job.source, fetchFn);
    if (!contentType.startsWith("image/"))
      throw new Error(`not an image (${contentType})`);
    if (body.byteLength > MAX_BYTES)
      throw new Error(`too large (${body.byteLength} bytes)`);

    const res = await fetchFn(
      `${base}/storage/v1/object/${target.bucket}/${objectPath(job.path)}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${target.serviceKey}`,
          apikey: target.serviceKey,
          "content-type": contentType,
          // Paths are content-unique, so browsers may cache them forever.
          "cache-control": "max-age=31536000",
          "x-upsert": "true",
        },
        body,
      },
    );
    if (!res.ok) throw new Error(`upload failed: HTTP ${res.status}`);
    return { path: job.path, status: "copied", bytes: body.byteLength };
  } catch (e) {
    return {
      path: job.path,
      status: "failed",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export type BucketSpec = {
  id: string;
  public: boolean;
  fileSizeLimit?: number;
  allowedMimeTypes?: string[];
};

/**
 * Creates a bucket unless it exists. Returns "created", "exists" or throws
 * (status only: the body may echo request details).
 */
export async function ensureBucket(
  target: Pick<StorageTarget, "url" | "serviceKey">,
  spec: BucketSpec,
  fetchFn: Fetch = fetch,
): Promise<"created" | "exists"> {
  const base = `${target.url.replace(/\/+$/, "")}/storage/v1/bucket`;
  const headers = {
    authorization: `Bearer ${target.serviceKey}`,
    apikey: target.serviceKey,
  };
  const found = await fetchFn(`${base}/${encodeURIComponent(spec.id)}`, {
    headers,
  });
  if (found.ok) return "exists";
  const res = await fetchFn(base, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({
      id: spec.id,
      name: spec.id,
      public: spec.public,
      file_size_limit: spec.fileSizeLimit ?? null,
      allowed_mime_types: spec.allowedMimeTypes ?? null,
    }),
  });
  if (!res.ok)
    throw new Error(`create bucket ${spec.id} failed: HTTP ${res.status}`);
  return "created";
}

/** Run jobs with a small concurrency limit (be gentle with both projects). */
export async function copyAll(
  jobs: readonly MediaJob[],
  target: StorageTarget,
  concurrency = 4,
  fetchFn: Fetch = fetch,
): Promise<CopyResult[]> {
  const results: CopyResult[] = [];
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      if (job) results.push(await copyMediaObject(job, target, fetchFn));
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}
