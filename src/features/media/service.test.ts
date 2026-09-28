import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { media, users } from "@/db/schema";
import { resetDb, type TestDb } from "@/test/db";
import { MEDIA_QUOTA_BYTES } from "./domain/upload";
import { createUpload, mediaExists, UPLOAD_LIMIT } from "./service";
import { signUpload } from "./storage";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());

const tdb = db as unknown as TestDb;
const NOW = new Date("2026-10-20T02:00:00Z");
const config = { url: "https://proj.supabase.co", serviceKey: "service-key" };
const req = {
  contentType: "image/webp",
  bytes: 80_000,
  width: 1280,
  height: 720,
} as const;

let admin: { id: string };

beforeEach(async () => {
  await resetDb(tdb);
  const [u] = await tdb
    .insert(users)
    .values({
      role: "admin",
      status: "active",
      fullName: "Cô giáo",
      username: "admin",
      passwordHash: "x",
    })
    .returning({ id: users.id });
  admin = { id: u?.id ?? "" };
});

describe("createUpload", () => {
  it("signs a content-unique path and records the file", async () => {
    const sign = vi.fn(
      async (_c: unknown, path: string) => `https://s/${path}`,
    );
    const result = await createUpload(admin, req, { now: NOW, config, sign });
    if (!result.ok) throw new Error(result.message);
    expect(result.data.path).toMatch(/^2026\/10\/[0-9a-f-]{36}\.webp$/);
    expect(result.data.uploadUrl).toBe(`https://s/${result.data.path}`);
    const rows = await tdb.select().from(media);
    expect(rows).toMatchObject([
      {
        path: result.data.path,
        bytes: 80_000,
        width: 1280,
        height: 720,
        uploadedBy: admin.id,
      },
    ]);
    expect(await mediaExists(result.data.path)).toBe(true);
    expect(await mediaExists("2026/10/other.webp")).toBe(false);
  });

  it("refuses without storage config, when signing fails, or over quota", async () => {
    expect(
      await createUpload(admin, req, { now: NOW, config: null }),
    ).toMatchObject({
      code: "STORAGE_UNAVAILABLE",
    });
    expect(
      await createUpload(admin, req, {
        now: NOW,
        config,
        sign: async () => null,
      }),
    ).toMatchObject({ code: "STORAGE_UNAVAILABLE" });
    await tdb
      .insert(media)
      .values({ path: "legacy/big.png", bytes: MEDIA_QUOTA_BYTES - 1000 });
    expect(
      await createUpload(admin, req, {
        now: NOW,
        config,
        sign: async () => "u",
      }),
    ).toMatchObject({ code: "STORAGE_FULL" });
    expect(await tdb.select().from(media)).toHaveLength(1);
  });

  it(`rate-limits to ${UPLOAD_LIMIT[0]} per 10 minutes`, async () => {
    const sign = async () => "https://s/u";
    for (let i = 0; i < UPLOAD_LIMIT[0]; i++)
      expect(
        (await createUpload(admin, req, { now: NOW, config, sign })).ok,
      ).toBe(true);
    expect(
      await createUpload(admin, req, { now: NOW, config, sign }),
    ).toMatchObject({
      code: "RATE_LIMITED",
    });
  });
});

describe("signUpload", () => {
  it("posts with the service key and returns the absolute signed URL", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({
        url: "/object/upload/sign/media/2026/10/a.webp?token=t",
      }),
    );
    const url = await signUpload(
      config,
      "2026/10/a.webp",
      fetchFn as typeof fetch,
    );
    expect(url).toBe(
      "https://proj.supabase.co/storage/v1/object/upload/sign/media/2026/10/a.webp?token=t",
    );
    expect(fetchFn).toHaveBeenCalledWith(
      "https://proj.supabase.co/storage/v1/object/upload/sign/media/2026/10/a.webp",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer service-key",
        }),
      }),
    );
  });

  it("is null on HTTP errors, network errors and odd responses", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const cases = [
      async () => new Response("no", { status: 403 }),
      async () => {
        throw new Error("offline");
      },
      async () => Response.json({ url: "https://evil.example/x" }),
      async () => new Response("not json"),
    ];
    for (const f of cases)
      expect(await signUpload(config, "a.webp", f as typeof fetch)).toBeNull();
    quiet.mockRestore();
  });
});
