import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { lessons } from "@/db/schema";
import type { TestDb } from "@/test/db";
import { DEFAULT_FILTERS, PAGE_SIZE } from "./domain/catalog";
import {
  getCatalog,
  getCatalogFacets,
  getLessonIdByLegacyId,
  getLessonOverview,
} from "./queries";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
// `"use cache"` is a no-op outside Next; stub the tag helpers.
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

const tdb = db as unknown as TestDb;
const f = (patch: Partial<typeof DEFAULT_FILTERS>) => ({
  ...DEFAULT_FILTERS,
  ...patch,
});

beforeAll(async () => {
  await tdb.insert(lessons).values([
    {
      title: "Đề ôn GK1 – Dao động cơ",
      legacyId: "1720000000000",
      description: "Ôn tập $T = 2\\pi/\\omega$.",
      grade: 12,
      chapter: "Dao động cơ",
      tags: ["giữa kì"],
      status: "published",
      sortOrder: 2,
      questionCount: 28,
      typeCounts: { mcq: 18, tf: 4, short: 6 },
      attemptCount: 5,
      config: {
        timeLimitSec: 3000,
        maxAttempts: 3,
        examGuard: true,
        countsForRating: true,
        answer: "NEVER_EXPOSE_CONFIG",
      },
      publishedAt: new Date("2026-01-01"),
    },
    {
      title: "Sóng cơ 100% trắc nghiệm",
      grade: 12,
      chapter: "Sóng cơ",
      tags: ["Lớp 12", "giữa kì"],
      status: "published",
      sortOrder: 1,
      attemptCount: 9,
      config: { timeLimitSec: null },
      publishedAt: new Date("2026-02-01"),
    },
    {
      title: "Điện trường",
      grade: 11,
      chapter: "Điện trường",
      status: "published",
      sortOrder: 3,
      config: {},
    },
    {
      legacyId: "draft",
      title: "Nháp dao động",
      grade: 12,
      status: "draft",
      config: {},
    },
    {
      legacyId: "archived",
      title: "Lưu trữ",
      status: "archived",
      chapter: "Cũ",
      config: {},
    },
    ...Array.from({ length: PAGE_SIZE + 2 }, (_, i) => ({
      title: `Bài luyện ${i}`,
      grade: 10,
      status: "published" as const,
      sortOrder: 100 + i,
      config: {},
    })),
  ]);
});

const titles = async (patch: Partial<typeof DEFAULT_FILTERS>) =>
  (await getCatalog(f(patch))).items.map((i) => i.title);

describe("getCatalog", () => {
  it("lists published lessons only, in manual order, one page at a time", async () => {
    const first = await getCatalog(f({}));
    expect(first.total).toBe(3 + PAGE_SIZE + 2);
    expect(first.items).toHaveLength(PAGE_SIZE);
    expect(first.items.slice(0, 3).map((i) => i.title)).toEqual([
      "Sóng cơ 100% trắc nghiệm",
      "Đề ôn GK1 – Dao động cơ",
      "Điện trường",
    ]);
    expect((await getCatalog(f({ page: 2 }))).items).toHaveLength(
      3 + PAGE_SIZE + 2,
    );
  });

  it("returns card fields, including the time limit from config", async () => {
    const [, gk1] = (await getCatalog(f({}))).items;
    expect(gk1).toEqual({
      id: expect.any(Number),
      title: "Đề ôn GK1 – Dao động cơ",
      grade: 12,
      chapter: "Dao động cơ",
      tags: ["giữa kì"],
      coverPath: null,
      questionCount: 28,
      typeCounts: { mcq: 18, tf: 4, short: 6 },
      timeLimitSec: 3000,
    });
  });

  it("searches without accents, in any word order, never matching drafts", async () => {
    expect(await titles({ q: "dao dong" })).toEqual([
      "Đề ôn GK1 – Dao động cơ",
    ]);
    expect(await titles({ q: "DONG dao" })).toEqual([
      "Đề ôn GK1 – Dao động cơ",
    ]);
    expect(await titles({ q: "lop 12" })).toEqual(["Sóng cơ 100% trắc nghiệm"]);
    expect(await titles({ q: "100%" })).toEqual(["Sóng cơ 100% trắc nghiệm"]);
    expect(await titles({ q: "%" })).toEqual(["Sóng cơ 100% trắc nghiệm"]);
    expect(await titles({ q: "không có" })).toEqual([]);
  });

  it("filters by grade, chapter and tag", async () => {
    expect(await titles({ grade: 11 })).toEqual(["Điện trường"]);
    expect(await titles({ chapter: "Sóng cơ" })).toEqual([
      "Sóng cơ 100% trắc nghiệm",
    ]);
    expect(await titles({ tag: "giữa kì", grade: 12 })).toEqual([
      "Sóng cơ 100% trắc nghiệm",
      "Đề ôn GK1 – Dao động cơ",
    ]);
  });

  it("sorts by newest, popularity and title", async () => {
    expect((await titles({ sort: "newest", grade: 12 }))[0]).toBe(
      "Sóng cơ 100% trắc nghiệm",
    );
    expect((await titles({ sort: "popular" })).slice(0, 2)).toEqual([
      "Sóng cơ 100% trắc nghiệm",
      "Đề ôn GK1 – Dao động cơ",
    ]);
    expect(await titles({ sort: "title", grade: 12 })).toEqual([
      "Đề ôn GK1 – Dao động cơ",
      "Sóng cơ 100% trắc nghiệm",
    ]);
    // "Điện" sorts with the D's, not after "S" as in byte order.
    expect((await titles({ sort: "title", page: 2 })).slice(-3)).toEqual([
      "Đề ôn GK1 – Dao động cơ",
      "Điện trường",
      "Sóng cơ 100% trắc nghiệm",
    ]);
  });
});

describe("getCatalogFacets", () => {
  it("lists chapters and tags of published lessons", async () => {
    expect(await getCatalogFacets()).toEqual({
      chapters: ["Dao động cơ", "Điện trường", "Sóng cơ"],
      tags: ["giữa kì", "Lớp 12"],
    });
  });
});

describe("lesson overview and legacy lookup", () => {
  it("returns an explicit safe projection, excluding arbitrary config and version fields", async () => {
    const id = await getLessonIdByLegacyId("1720000000000");
    expect(id).not.toBeNull();
    const overview = await getLessonOverview(id as number);
    expect(overview).toEqual({
      ...(await getCatalog(f({ q: "dao dong" }))).items[0],
      description: "Ôn tập $T = 2\\pi/\\omega$.",
      status: "published",
      maxAttempts: 3,
      examGuard: true,
      countsForRating: true,
      revealAnswers: "after_submit",
    });
    expect(JSON.stringify(overview)).not.toContain("NEVER_EXPOSE_CONFIG");
  });

  it.each([
    "draft",
    "archived",
  ])("hides %s metadata unless the caller authorizes admin access", async (key) => {
    expect(await getLessonIdByLegacyId(key)).toBeNull();
    const id = await getLessonIdByLegacyId(key, true);
    expect(id).not.toBeNull();
    expect(await getLessonOverview(id as number)).toBeNull();
    expect(await getLessonOverview(id as number, true)).toMatchObject({
      status: key,
    });
  });

  it("returns null for missing ids and treats SQL-like legacy keys literally", async () => {
    expect(await getLessonOverview(999999)).toBeNull();
    expect(await getLessonIdByLegacyId("' OR 1=1 --")).toBeNull();
  });
});
