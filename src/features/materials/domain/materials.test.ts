import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { compile } from "@mdx-js/mdx";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { describe, expect, it } from "vitest";
import { catalog } from "@/content/ly-thuyet/catalog";
import {
  allTopics,
  findTopic,
  foldVietnamese,
  materialRedirects,
  searchTopics,
  topicParams,
} from "./materials";
import type { MaterialCatalog } from "./types";

const CONTENT = join(process.cwd(), "src", "content", "ly-thuyet");

describe("theory catalog (S8-02)", () => {
  it("has every v1 material entry: 56 pages in 15 chapters", () => {
    expect(allTopics(catalog)).toHaveLength(56);
    expect(catalog.map((g) => g.grade)).toEqual([10, 11, 12]);
    expect(catalog.map((g) => g.chapters.map((c) => c.topics.length))).toEqual([
      [5, 2, 3, 3],
      [4, 4, 4, 4],
      [4, 5, 4, 3, 4, 3, 4],
    ]);
    // v1's list linked 55 of them; the 56th is the page it never linked.
    expect(
      allTopics(catalog).filter((r) => r.topic.subtopics.length > 0),
    ).toHaveLength(55);
  });

  it("keeps grade 12's reference links, all https", () => {
    const links = catalog.flatMap((g) => g.chapters.flatMap((c) => c.links));
    expect(links).toHaveLength(24);
    for (const l of links) {
      expect(l.url).toMatch(/^https:\/\//);
      expect(l.title.length).toBeGreaterThan(2);
    }
  });

  it("has unique URLs and one MDX file per topic, and nothing else", () => {
    const hrefs = allTopics(catalog).map((r) => r.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const p of topicParams(catalog))
      expect(
        existsSync(join(CONTENT, p.grade, p.chapter, `${p.slug}.mdx`)),
        `${p.grade}/${p.chapter}/${p.slug}`,
      ).toBe(true);
    const files = readdirSync(CONTENT, { recursive: true }).filter((f) =>
      String(f).endsWith(".mdx"),
    );
    expect(files).toHaveLength(56);
  });

  it("compiles every page with the app's plugins, formulas included", async () => {
    let formulas = 0;
    for (const p of topicParams(catalog)) {
      const source = readFileSync(
        join(CONTENT, p.grade, p.chapter, `${p.slug}.mdx`),
        "utf8",
      );
      const code = String(
        await compile(source, {
          remarkPlugins: [remarkMath],
          rehypePlugins: [[rehypeKatex, { strict: "ignore", trust: false }]],
        }),
      );
      const where = `${p.grade}/${p.chapter}/${p.slug}`;
      expect(code, where).not.toContain("katex-error");
      // Only the components mdx-components.tsx provides.
      const used = [...code.matchAll(/\{(\w+(?:, \w+)*)\} = _components/g)]
        .flatMap((m) => (m[1] ?? "").split(", "))
        .filter(Boolean);
      for (const name of used)
        expect(["Callout", "Formula", "Table"], where).toContain(name);
      // No leftover MathJax `\(` or raw HTML from v1 (`\[` is an escaped
      // bracket now: MathJax's display delimiters became `$$`).
      expect(source, where).not.toMatch(/\\\(|<div|<span|style=/);
      formulas += (code.match(/className: "katex"/g) ?? []).length;
    }
    expect(formulas).toBeGreaterThan(100);
  }, 60_000);
});

const tiny: MaterialCatalog = [
  {
    grade: 11,
    chapters: [
      {
        slug: "dao-dong",
        title: "Dao động",
        description: "",
        links: [],
        topics: ["a", "b", "c"].map((slug) => ({
          slug,
          title: slug === "b" ? "Con lắc đơn" : `Bài ${slug}`,
          description: "",
          subtopics: slug === "c" ? ["Định luật Ohm"] : [],
          legacyPath: `grade11/dao-dong/${slug}`,
        })),
      },
    ],
  },
];

describe("findTopic", () => {
  it("returns the topic with its neighbours in the chapter", () => {
    const hit = findTopic(tiny, {
      grade: "11",
      chapter: "dao-dong",
      slug: "b",
    });
    expect(hit?.topic.title).toBe("Con lắc đơn");
    expect(hit?.href).toBe("/ly-thuyet/11/dao-dong/b");
    expect(hit?.previous?.topic.slug).toBe("a");
    expect(hit?.next?.topic.slug).toBe("c");
    const first = findTopic(tiny, {
      grade: "11",
      chapter: "dao-dong",
      slug: "a",
    });
    expect(first?.previous).toBeNull();
  });

  it("is null for an unknown grade, chapter or slug", () => {
    for (const p of [
      { grade: "12", chapter: "dao-dong", slug: "a" },
      { grade: "11", chapter: "song", slug: "a" },
      { grade: "11", chapter: "dao-dong", slug: "z" },
    ])
      expect(findTopic(tiny, p)).toBeNull();
  });
});

describe("searchTopics", () => {
  it("ignores accents and case and needs every word", () => {
    expect(foldVietnamese("  Định  LUẬT Ohm ")).toBe("dinh luat ohm");
    expect(searchTopics(tiny, "con lac don").map((r) => r.topic.slug)).toEqual([
      "b",
    ]);
    expect(searchTopics(tiny, "ĐỊNH LUẬT")).toHaveLength(1); // a subtopic
    expect(searchTopics(tiny, "lop 11")).toHaveLength(3);
    expect(searchTopics(tiny, "con lac lo xo")).toEqual([]);
    expect(searchTopics(tiny, "   ")).toEqual([]);
  });

  it("puts titles with the whole query first", () => {
    const hits = searchTopics(catalog, "con lac don");
    expect(hits.slice(0, 2).map((r) => [r.grade, r.topic.title])).toEqual([
      [11, "Con lắc đơn"],
      [12, "Con lắc đơn"],
    ]);
  });
});

describe("materialRedirects", () => {
  it("maps each v1 page to its v2 URL", () => {
    const redirects = materialRedirects(catalog);
    expect(redirects).toHaveLength(56);
    expect(redirects).toContainEqual({
      source: "/materials/grade10/motion_kinematics/chuyen_dong_thang_deu",
      destination: "/ly-thuyet/10/chuyen-dong/chuyen-dong-thang-deu",
    });
    expect(redirects).toContainEqual({
      source: "/materials/grade12/song-co-song-am/song_am",
      destination: "/ly-thuyet/12/song-co-song-am/song-am",
    });
  });
});
