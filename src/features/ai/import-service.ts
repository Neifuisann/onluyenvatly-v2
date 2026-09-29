import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { media } from "@/db/schema";
import {
  MAX_UPLOAD_BYTES,
  MEDIA_QUOTA_BYTES,
  mediaObjectPath,
  UPLOAD_TYPES,
  type UploadType,
} from "@/features/media/domain/upload";
import {
  downloadObject,
  IMPORTS_BUCKET,
  listObjects,
  MEDIA_BUCKET,
  removeObjects,
  type StorageConfig,
  signUpload,
  storageConfig,
  uploadObject,
} from "@/features/media/storage";
import { rateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import { ai as defaultAi } from "./client";
import {
  htmlToLessonText,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_OUTPUT_TOKENS,
  IMPORT_SYSTEM,
  IMPORT_TTL_MS,
  IMPORTS_PER_HOUR,
  type ImportContentType,
  importFolders,
  importObjectPath,
  importPrompt,
  sniffImport,
} from "./domain/import";
import { AI_TIMEOUT_MS } from "./domain/policy";
import type { Ai, AiFailure, AiText } from "./gemini";
import { importCopy as t } from "./messages";

/**
 * AI import (09 AI2, S7-04). The browser uploads the exam straight to the
 * private `imports` bucket through a signed URL (the bytes never pass
 * through a function body); `POST /api/ai/import` then reads it back here,
 * turns a DOCX into text (its images go to `media`) or sends a PDF/image as
 * inline data, and streams Gemini's lesson text. Nothing is written until
 * the teacher creates the draft. Files are removed by the daily cron.
 */

type Admin = { id: string };

/** A DOCX's images come back through this; returns the `media` path or null. */
export type StoreImage = (image: {
  contentType: string;
  bytes: Uint8Array<ArrayBuffer>;
}) => Promise<string | null>;
export type DocxToHtml = (
  bytes: Uint8Array,
  storeImage: StoreImage,
) => Promise<string>;

type Deps = {
  ai?: Ai;
  config?: StorageConfig | null;
  now?: Date;
  docxToHtml?: DocxToHtml;
  fetchFn?: typeof fetch;
};

const noStorage = () => err("STORAGE_UNAVAILABLE", { message: t.noStorage });

/** A signed upload URL for one exam file (≤ 10 MB) in `imports`. */
export async function createImportUpload(
  admin: Admin,
  input: { contentType: ImportContentType; bytes: number },
  { config = storageConfig(), now = new Date(), fetchFn = fetch }: Deps = {},
): Promise<Result<{ path: string; uploadUrl: string }>> {
  if (!config) return noStorage();
  const limit = await rateLimit(
    `ai:import-upload:${admin.id}`,
    IMPORTS_PER_HOUR * 2,
    "1h",
    now,
  );
  if (!limit.ok) return err("RATE_LIMITED");
  const path = importObjectPath(now, randomUUID(), input.contentType);
  const uploadUrl = await signUpload(config, path, fetchFn, IMPORTS_BUCKET);
  return uploadUrl ? ok({ path, uploadUrl }) : noStorage();
}

/** Images a DOCX may bring along; the rest become `[Hình]`. */
const MAX_DOCX_IMAGES = 60;

function imageStore(
  admin: Admin,
  config: StorageConfig,
  now: Date,
  fetchFn: typeof fetch,
): StoreImage {
  let stored = 0;
  return async ({ contentType, bytes }) => {
    if (!(contentType in UPLOAD_TYPES)) return null;
    if (bytes.byteLength > MAX_UPLOAD_BYTES || stored >= MAX_DOCX_IMAGES)
      return null;
    const [used] = await db
      .select({ bytes: sql<number>`coalesce(sum(${media.bytes}), 0)::bigint` })
      .from(media);
    if (Number(used?.bytes ?? 0) + bytes.byteLength > MEDIA_QUOTA_BYTES)
      return null;
    const path = mediaObjectPath(now, randomUUID(), contentType as UploadType);
    if (
      !(await uploadObject(
        config,
        MEDIA_BUCKET,
        path,
        bytes,
        contentType,
        fetchFn,
      ))
    )
      return null;
    await db.insert(media).values({
      path,
      bytes: bytes.byteLength,
      uploadedBy: admin.id,
    });
    stored++;
    return path;
  };
}

/** mammoth, loaded on first use (it is only needed here). */
const mammothToHtml: DocxToHtml = async (bytes, storeImage) => {
  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml(
    { buffer: Buffer.from(bytes) },
    {
      // Never follow links from the document to other files.
      externalFileAccess: false,
      convertImage: mammoth.images.imgElement(async (image) => {
        const path = await storeImage({
          contentType: image.contentType,
          bytes: new Uint8Array(await image.readAsArrayBuffer()),
        });
        return { src: path ? `media:${path}` : "" };
      }),
    },
  );
  return result.value;
};

export type ImportStream = {
  model: string;
  chunks: AsyncIterable<string>;
  result: Promise<AiText | AiFailure>;
};

const aiFailure = (f: AiFailure) =>
  err(f.code, { message: f.code === "AI_QUOTA" ? t.quota : t.unavailable });

/**
 * `POST /api/ai/import` (05 §3): reads the uploaded file and starts the
 * Gemini stream through the gate and the daily budget.
 */
export async function startImport(
  admin: Admin,
  input: { path: string },
  {
    ai = defaultAi,
    config = storageConfig(),
    now = new Date(),
    docxToHtml = mammothToHtml,
    fetchFn = fetch,
  }: Deps = {},
): Promise<Result<ImportStream>> {
  if (!config) return noStorage();
  const limit = await rateLimit(
    `ai:import:${admin.id}`,
    IMPORTS_PER_HOUR,
    "1h",
    now,
  );
  if (!limit.ok) return err("RATE_LIMITED");
  const bytes = await downloadObject(
    config,
    IMPORTS_BUCKET,
    input.path,
    IMPORT_MAX_BYTES,
    fetchFn,
  );
  if (!bytes) return err("NOT_FOUND", { message: t.fileMissing });
  const file = sniffImport(bytes);
  if (!file) return err("VALIDATION", { message: t.badFile });

  let contents: Parameters<Ai["streamText"]>[0]["contents"];
  if (file.kind === "docx") {
    let html: string;
    try {
      html = await docxToHtml(bytes, imageStore(admin, config, now, fetchFn));
    } catch {
      return err("VALIDATION", { message: t.badFile });
    }
    const text = htmlToLessonText(html);
    if (!text) return err("VALIDATION", { message: t.emptyFile });
    contents = importPrompt(text);
  } else {
    contents = [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: file.mimeType,
              data: Buffer.from(bytes).toString("base64"),
            },
          },
          { text: importPrompt() },
        ],
      },
    ];
  }

  const stream = await ai.streamText({
    feature: "import",
    kind: "import",
    system: IMPORT_SYSTEM,
    contents,
    timeoutMs: AI_TIMEOUT_MS.import,
    maxOutputTokens: IMPORT_MAX_OUTPUT_TOKENS,
    temperature: 0.1,
  });
  if (!stream.ok) return aiFailure(stream);
  return ok({
    model: stream.model,
    chunks: stream.chunks,
    result: stream.result,
  });
}

/**
 * Daily cron (09 §4): removes import files older than a day from this
 * month's and last month's folders. Returns how many were removed.
 */
export async function cleanupImports({
  config = storageConfig(),
  now = new Date(),
  fetchFn = fetch,
}: Deps = {}): Promise<number> {
  if (!config) return 0;
  const cutoff = now.getTime() - IMPORT_TTL_MS;
  let removed = 0;
  for (const folder of importFolders(now)) {
    const files = await listObjects(config, IMPORTS_BUCKET, folder, fetchFn);
    const old = (files ?? [])
      .filter((f) => f.createdAt && f.createdAt.getTime() < cutoff)
      .map((f) => `${folder}/${f.name}`);
    if (
      old.length &&
      (await removeObjects(config, IMPORTS_BUCKET, old, fetchFn))
    )
      removed += old.length;
  }
  return removed;
}
