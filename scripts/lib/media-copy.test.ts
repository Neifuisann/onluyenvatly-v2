import { describe, expect, it } from "vitest";
import { copyAll, copyMediaObject } from "./media-copy";

const target = {
  url: "https://v2.supabase.test/",
  serviceKey: "service-key-for-tests",
  bucket: "media",
};

type Call = { url: string; method: string; headers: Record<string, string> };

/** A fake fetch: `existing` paths answer HEAD 200, `sources` serve bytes. */
function fakeFetch(opts: {
  existing?: string[];
  sources?: Record<string, { status?: number; type?: string; bytes?: number }>;
  uploadStatus?: number;
}) {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({
      url,
      method,
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    if (method === "HEAD") {
      const hit = opts.existing?.some((p) => url.endsWith(p));
      return new Response(null, {
        status: hit ? 200 : 400,
        headers: hit ? { "content-length": "42" } : {},
      });
    }
    if (method === "POST")
      return new Response("{}", { status: opts.uploadStatus ?? 200 });
    const src = opts.sources?.[url];
    if (!src) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(src.bytes ?? 3), {
      status: src.status ?? 200,
      headers: { "content-type": src.type ?? "image/png" },
    });
  }) as typeof fetch;
  return { fn, calls };
}

const job = (source: string, path = "legacy/a.png") => ({
  source,
  path,
  lessonLegacyId: "1",
});

describe("copyMediaObject", () => {
  it("skips objects already in the bucket", async () => {
    const { fn, calls } = fakeFetch({ existing: ["legacy/a.png"] });
    expect(await copyMediaObject(job("https://v1/a.png"), target, fn)).toEqual({
      path: "legacy/a.png",
      status: "exists",
      bytes: 42,
    });
    expect(calls).toHaveLength(1);
  });

  it("downloads from v1 and uploads with the service key and long cache", async () => {
    const { fn, calls } = fakeFetch({
      sources: { "https://v1/a.png": { bytes: 5 } },
    });
    expect(await copyMediaObject(job("https://v1/a.png"), target, fn)).toEqual({
      path: "legacy/a.png",
      status: "copied",
      bytes: 5,
    });
    const upload = calls.find((c) => c.method === "POST");
    expect(upload?.url).toBe(
      "https://v2.supabase.test/storage/v1/object/media/legacy/a.png",
    );
    expect(upload?.headers).toMatchObject({
      authorization: "Bearer service-key-for-tests",
      "content-type": "image/png",
      "cache-control": "max-age=31536000",
      "x-upsert": "true",
    });
  });

  it("decodes base64 covers without downloading", async () => {
    const { fn, calls } = fakeFetch({});
    const res = await copyMediaObject(
      job("data:image/jpeg;base64,AAECAw==", "legacy/covers/lesson-1.jpg"),
      target,
      fn,
    );
    expect(res).toMatchObject({ status: "copied", bytes: 4 });
    expect(calls.map((c) => c.method)).toEqual(["HEAD", "POST"]);
  });

  it.each([
    ["a missing source", {}, "HTTP 404"],
    [
      "a non-image",
      { sources: { "https://v1/a.png": { type: "text/html" } } },
      "not an image",
    ],
    [
      "a huge file",
      { sources: { "https://v1/a.png": { bytes: 11 * 1024 * 1024 } } },
      "too large",
    ],
    [
      "an upload error",
      { sources: { "https://v1/a.png": {} }, uploadStatus: 403 },
      "upload failed",
    ],
  ])("reports %s as failed", async (_, opts, error) => {
    const { fn } = fakeFetch(opts);
    const res = await copyMediaObject(job("https://v1/a.png"), target, fn);
    expect(res).toMatchObject({ status: "failed" });
    expect(res.status === "failed" && res.error).toContain(error);
  });
});

describe("copyAll", () => {
  it("copies every job with limited concurrency", async () => {
    const sources = Object.fromEntries(
      Array.from({ length: 7 }, (_, i) => [`https://v1/${i}.png`, {}]),
    );
    const { fn } = fakeFetch({ sources });
    const jobs = Object.keys(sources).map((s, i) => job(s, `legacy/${i}.png`));
    const results = await copyAll(jobs, target, 3, fn);
    expect(results).toHaveLength(7);
    expect(results.every((r) => r.status === "copied")).toBe(true);
  });
});
