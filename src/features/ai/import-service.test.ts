import type {
  GenerateContentParameters,
  GenerateContentResponse,
} from "@google/genai";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { auditLog, lessons, lessonVersions, media, users } from "@/db/schema";
import { createImportedLesson } from "@/features/lessons/content-service";
import { resetDb, type TestDb } from "@/test/db";
import { makeDocx, makeZip } from "@/test/docx";
import { IMPORT_SYSTEM, IMPORTS_PER_HOUR } from "./domain/import";
import { type AiGate, createAi, type GeminiModels } from "./gemini";
import {
  cleanupImports,
  createImportUpload,
  type DocxToHtml,
  startImport,
} from "./import-service";
import { importCopy } from "./messages";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

const tdb = db as unknown as TestDb;
const NOW = new Date("2026-10-20T02:00:00Z");
const config = { url: "https://storage.test", serviceKey: "key" };
const PDF = new TextEncoder().encode("%PDF-1.7\nfake");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

/** In-memory Storage: the REST calls `media/storage.ts` makes. */
function fakeStorage() {
  const objects = new Map<string, { bytes: Uint8Array; createdAt: string }>();
  const calls: string[] = [];
  const fetchFn = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const path = decodeURIComponent(url.pathname.replace("/storage/v1", ""));
      const method = init?.method ?? "GET";
      calls.push(`${method} ${path}`);
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status });
      let m = path.match(/^\/object\/upload\/sign\/(\w+)\/(.+)$/);
      if (m)
        return json({ url: `/object/upload/sign/${m[1]}/${m[2]}?token=t` });
      m = path.match(/^\/object\/list\/(\w+)$/);
      if (m) {
        const { prefix } = JSON.parse(String(init?.body)) as { prefix: string };
        const folder = `${m[1]}/${prefix}/`;
        return json(
          [...objects]
            .filter(([k]) => k.startsWith(folder))
            .map(([k, o]) => ({
              name: k.slice(folder.length),
              id: k,
              created_at: o.createdAt,
            }))
            .concat([{ name: "sub", id: null, created_at: null } as never]),
        );
      }
      m = path.match(/^\/object\/(\w+)$/);
      if (m && method === "DELETE") {
        const { prefixes } = JSON.parse(String(init?.body)) as {
          prefixes: string[];
        };
        for (const p of prefixes) objects.delete(`${m[1]}/${p}`);
        return json([]);
      }
      m = path.match(/^\/object\/(\w+)\/(.+)$/);
      if (m && method === "POST") {
        objects.set(`${m[1]}/${m[2]}`, {
          bytes: new Uint8Array(init?.body as Uint8Array),
          createdAt: NOW.toISOString(),
        });
        return json({ Key: `${m[1]}/${m[2]}` });
      }
      if (m && method === "GET") {
        const o = objects.get(`${m[1]}/${m[2]}`);
        return o
          ? new Response(o.bytes as Uint8Array<ArrayBuffer>)
          : json({ error: "not found" }, 400);
      }
      return json({ error: "no route" }, 404);
    },
  );
  const put = (path: string, bytes: Uint8Array, createdAt = NOW) =>
    objects.set(`imports/${path}`, {
      bytes,
      createdAt: createdAt.toISOString(),
    });
  return { fetchFn: fetchFn as unknown as typeof fetch, objects, calls, put };
}

/** Streams `reply` in two chunks, or `null` = truncated. */
function fakeAi(reply: string | null = "Câu 1: a\n*A. x\nB. y", gate?: AiGate) {
  const text = reply ?? "Câu 1: nửa";
  const client = {
    generateContent: vi.fn(),
    generateContentStream: vi.fn(async (_p: GenerateContentParameters) =>
      (async function* () {
        const half = Math.ceil(text.length / 2);
        yield { text: text.slice(0, half) } as GenerateContentResponse;
        yield {
          text: text.slice(half),
          candidates: [
            { finishReason: reply === null ? "MAX_TOKENS" : "STOP" },
          ],
        } as unknown as GenerateContentResponse;
      })(),
    ),
  };
  const ai = createAi({
    client: () => client as unknown as GeminiModels,
    models: { text: [], import: ["gemini-import"] },
    gate: gate ?? (async () => ({ ok: true })),
    log: () => {},
  });
  return { ai, client };
}

async function drain(chunks: AsyncIterable<string>) {
  let text = "";
  for await (const c of chunks) text += c;
  return text;
}

const PATH = "2026/10/0b5f2d4e-8c1a-4f7e-9d3b-2a6c8e1f0a9b.pdf";
let admin: { id: string; role: "admin" };

beforeEach(async () => {
  await resetDb(tdb);
  const [u] = await tdb
    .insert(users)
    .values({
      role: "admin",
      status: "active",
      fullName: "Giáo viên",
      username: "gv",
      passwordHash: "x",
    })
    .returning({ id: users.id });
  admin = { id: u?.id ?? "", role: "admin" };
});

describe("createImportUpload", () => {
  it("signs an upload into the imports bucket, within the hourly limit", async () => {
    const storage = fakeStorage();
    const deps = { config, now: NOW, fetchFn: storage.fetchFn };
    const ticket = await createImportUpload(
      admin,
      { contentType: "application/pdf", bytes: 1000 },
      deps,
    );
    expect(ticket).toMatchObject({
      ok: true,
      data: {
        path: expect.stringMatching(/^2026\/10\/[0-9a-f-]{36}\.pdf$/),
        uploadUrl: expect.stringMatching(
          /^https:\/\/storage\.test\/storage\/v1\/object\/upload\/sign\/imports\/2026\/10\//,
        ),
      },
    });
    for (let i = 1; i < IMPORTS_PER_HOUR * 2; i++)
      await createImportUpload(
        admin,
        { contentType: "image/png", bytes: 10 },
        deps,
      );
    expect(
      await createImportUpload(
        admin,
        { contentType: "image/png", bytes: 10 },
        deps,
      ),
    ).toMatchObject({ ok: false, code: "RATE_LIMITED" });
  });

  it("says so without Storage", async () => {
    expect(
      await createImportUpload(
        admin,
        { contentType: "application/pdf", bytes: 1 },
        { config: null },
      ),
    ).toMatchObject({
      ok: false,
      code: "STORAGE_UNAVAILABLE",
      message: importCopy.noStorage,
    });
  });
});

describe("startImport", () => {
  it("sends a PDF as inline data with the format prompt and streams the text", async () => {
    const storage = fakeStorage();
    storage.put(PATH, PDF);
    const { ai, client } = fakeAi();
    const result = await startImport(
      admin,
      { path: PATH },
      { ai, config, now: NOW, fetchFn: storage.fetchFn },
    );
    if (!result.ok) throw new Error(result.code);
    expect(await drain(result.data.chunks)).toBe("Câu 1: a\n*A. x\nB. y");
    expect(await result.data.result).toMatchObject({
      ok: true,
      complete: true,
    });
    const params = client.generateContentStream.mock.calls[0]?.[0];
    expect(params?.model).toBe("gemini-import");
    expect(params?.config?.systemInstruction).toBe(IMPORT_SYSTEM);
    expect(params?.contents).toEqual([
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: Buffer.from(PDF).toString("base64"),
            },
          },
          { text: expect.stringContaining("file đính kèm") },
        ],
      },
    ]);
  });

  it("sends a photo of an exam as an image", async () => {
    const storage = fakeStorage();
    storage.put(PATH, PNG);
    const { ai, client } = fakeAi();
    const result = await startImport(
      admin,
      { path: PATH },
      { ai, config, now: NOW, fetchFn: storage.fetchFn },
    );
    expect(result.ok).toBe(true);
    expect(
      JSON.stringify(client.generateContentStream.mock.calls[0]?.[0].contents),
    ).toContain('"mimeType":"image/png"');
  });

  it("reads a real DOCX with mammoth and sends its text", async () => {
    const storage = fakeStorage();
    storage.put(
      PATH,
      makeDocx(["Câu 1: Đơn vị của chu kì là", "A. Giây", "B. Héc"]),
    );
    const { ai, client } = fakeAi();
    const result = await startImport(
      admin,
      { path: PATH },
      { ai, config, now: NOW, fetchFn: storage.fetchFn },
    );
    expect(result.ok).toBe(true);
    const prompt = String(
      client.generateContentStream.mock.calls[0]?.[0].contents,
    );
    expect(prompt).toContain("Câu 1: Đơn vị của chu kì là\nA. Giây\nB. Héc");
  });

  it("stores a DOCX's images in media and marks the others [Hình]", async () => {
    const storage = fakeStorage();
    storage.put(PATH, makeDocx(["x"]));
    const { ai, client } = fakeAi();
    const docxToHtml: DocxToHtml = async (_bytes, storeImage) => {
      const png = await storeImage({ contentType: "image/png", bytes: PNG });
      const emf = await storeImage({
        contentType: "image/x-emf",
        bytes: new Uint8Array([1]),
      });
      const big = await storeImage({
        contentType: "image/jpeg",
        bytes: new Uint8Array(3 * 1024 * 1024),
      });
      return `<p>Câu 1: Hình vẽ</p><img src="${png ? `media:${png}` : ""}"/><img src="${emf ?? ""}"/><img src="${big ?? ""}"/>`;
    };
    const result = await startImport(
      admin,
      { path: PATH },
      { ai, config, now: NOW, fetchFn: storage.fetchFn, docxToHtml },
    );
    expect(result.ok).toBe(true);
    const rows = await tdb.select().from(media);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      bytes: PNG.byteLength,
      uploadedBy: admin.id,
    });
    expect(rows[0]?.path).toMatch(/^2026\/10\/[0-9a-f-]{36}\.png$/);
    expect(storage.objects.has(`media/${rows[0]?.path}`)).toBe(true);
    const prompt = String(
      client.generateContentStream.mock.calls[0]?.[0].contents,
    );
    expect(prompt).toContain(`![](media:${rows[0]?.path})`);
    expect(prompt.match(/\[Hình\]/g)).toHaveLength(2);
  });

  it("refuses missing, unknown, broken and empty files before calling Gemini", async () => {
    const storage = fakeStorage();
    const { ai, client } = fakeAi();
    const deps = { ai, config, now: NOW, fetchFn: storage.fetchFn };
    expect(await startImport(admin, { path: PATH }, deps)).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
      message: importCopy.fileMissing,
    });
    storage.put(PATH, new TextEncoder().encode("MZ executable"));
    expect(await startImport(admin, { path: PATH }, deps)).toMatchObject({
      code: "VALIDATION",
      message: importCopy.badFile,
    });
    storage.put(PATH, makeZip());
    expect(await startImport(admin, { path: PATH }, deps)).toMatchObject({
      code: "VALIDATION",
      message: importCopy.badFile,
    });
    storage.put(PATH, makeDocx(["   "]));
    expect(await startImport(admin, { path: PATH }, deps)).toMatchObject({
      code: "VALIDATION",
      message: importCopy.emptyFile,
    });
    expect(
      await startImport(admin, { path: PATH }, { ...deps, config: null }),
    ).toMatchObject({ code: "STORAGE_UNAVAILABLE" });
    expect(client.generateContentStream).not.toHaveBeenCalled();
  });

  it("passes on the budget's refusal and a truncated answer", async () => {
    const storage = fakeStorage();
    storage.put(PATH, PDF);
    const quota = await startImport(
      admin,
      { path: PATH },
      {
        ai: fakeAi("x", async () => ({
          ok: false,
          code: "AI_QUOTA",
          reason: "budget",
        })).ai,
        config,
        now: NOW,
        fetchFn: storage.fetchFn,
      },
    );
    expect(quota).toMatchObject({
      code: "AI_QUOTA",
      message: importCopy.quota,
    });
    const off = await startImport(
      admin,
      { path: PATH },
      {
        ai: fakeAi("x", async () => ({
          ok: false,
          code: "AI_UNAVAILABLE",
          reason: "disabled",
        })).ai,
        config,
        now: NOW,
        fetchFn: storage.fetchFn,
      },
    );
    expect(off).toMatchObject({ message: importCopy.unavailable });
    const cut = await startImport(
      admin,
      { path: PATH },
      { ai: fakeAi(null).ai, config, now: NOW, fetchFn: storage.fetchFn },
    );
    if (!cut.ok) throw new Error(cut.code);
    await drain(cut.data.chunks);
    expect(await cut.data.result).toMatchObject({ ok: true, complete: false });
  });

  it("limits imports per hour", async () => {
    const storage = fakeStorage();
    storage.put(PATH, PDF);
    const deps = {
      ai: fakeAi().ai,
      config,
      now: NOW,
      fetchFn: storage.fetchFn,
    };
    for (let i = 0; i < IMPORTS_PER_HOUR; i++) {
      const r = await startImport(admin, { path: PATH }, deps);
      if (r.ok) await drain(r.data.chunks);
    }
    expect(await startImport(admin, { path: PATH }, deps)).toMatchObject({
      code: "RATE_LIMITED",
    });
  });
});

describe("cleanupImports", () => {
  it("removes files older than a day in this month's and last month's folders", async () => {
    const storage = fakeStorage();
    const day = 24 * 60 * 60 * 1000;
    storage.put("2026/09/old.pdf", PDF, new Date(NOW.getTime() - 20 * day));
    storage.put("2026/10/old.pdf", PDF, new Date(NOW.getTime() - day - 1));
    storage.put("2026/10/new.pdf", PDF, new Date(NOW.getTime() - 60_000));
    expect(
      await cleanupImports({ config, now: NOW, fetchFn: storage.fetchFn }),
    ).toBe(2);
    expect([...storage.objects.keys()]).toEqual(["imports/2026/10/new.pdf"]);
    expect(await cleanupImports({ config: null })).toBe(0);
  });
});

describe("createImportedLesson", () => {
  it("creates a draft with the text, counts and an audit row", async () => {
    const created = await createImportedLesson(admin, {
      title: "Đề giữa kì",
      sourceText: "Câu 1: a\n*A. x\nB. y\n\nCâu 2: b\nA. x\nB. y",
    });
    expect(created).toMatchObject({ questions: 1, errors: 1 });
    const [lesson] = await tdb
      .select()
      .from(lessons)
      .where(eq(lessons.id, created.id));
    expect(lesson).toMatchObject({
      title: "Đề giữa kì",
      status: "draft",
      currentVersionId: null,
    });
    const [version] = await tdb
      .select()
      .from(lessonVersions)
      .where(eq(lessonVersions.id, lesson?.draftVersionId ?? 0));
    expect(version?.sourceText).toContain("Câu 2: b");
    expect(
      await tdb
        .select({ action: auditLog.action, data: auditLog.data })
        .from(auditLog),
    ).toEqual([
      {
        action: "lesson.import",
        data: { versionId: version?.id, questions: 1, errors: 1 },
      },
    ]);
  });
});
