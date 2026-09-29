/**
 * S8-02: converts v1's theory materials (`materials/**` HTML + index JSON)
 * into MDX pages and a typed catalog. One-off, output committed:
 *
 *   node scripts/convert-materials.ts ../onluyenvatly
 *
 * Writes `src/content/ly-thuyet/<grade>/<chapter>/<topic>.mdx` and
 * `src/content/ly-thuyet/catalog.ts`, replacing earlier output. Entries come
 * from what v1's /study-materials page listed (grade 10 index.json and the
 * grade 11/12 tables inside views/study-materials.html), plus the one HTML
 * page it never linked. Grade 12's reference links (materials.json) become
 * each chapter's external links. Scripts, styles and inline CSS are dropped;
 * the page chrome comes from the app.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, posix } from "node:path";
import { parse } from "parse5";

type Node = {
  nodeName: string;
  tagName?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: Node[];
  value?: string;
  content?: Node;
};

type Topic = {
  slug: string;
  title: string;
  description: string;
  subtopics: string[];
  legacyPath: string;
};
type Link = { title: string; url: string; group: string };
type Chapter = {
  slug: string;
  title: string;
  description: string;
  topics: Topic[];
  links: Link[];
};
type Grade = { grade: 10 | 11 | 12; chapters: Chapter[] };

const v1Root = process.argv[2];
if (!v1Root) {
  console.error("Usage: node scripts/convert-materials.ts <path to v1 repo>");
  process.exit(1);
}
const MATERIALS = join(v1Root, "materials");
const OUT = join("src", "content", "ly-thuyet");

// Grade 10's chapter folders have English ids; v2 URLs are Vietnamese.
const GRADE10_CHAPTERS: Record<string, string> = {
  motion_kinematics: "chuyen-dong",
  forces_dynamics: "luc-va-dong-luc-hoc",
  energy: "nang-luong",
  momentum: "dong-luong",
};
const chapterSlug = (grade: number, folder: string) =>
  grade === 10 ? (GRADE10_CHAPTERS[folder] ?? folder) : folder;
const topicSlug = (file: string) =>
  file.replace(/\.(html|json)$/, "").replace(/_/g, "-");

// ---------------------------------------------------------------- entries

/** Evaluates one object literal from v1's page script (static data only). */
function pageTable(name: string): Record<string, V1Entry[]> {
  const html = readFileSync(
    join(v1Root as string, "views", "study-materials.html"),
    "utf8",
  );
  const start = html.indexOf(`const ${name} = {`);
  if (start < 0) throw new Error(`${name} not found in study-materials.html`);
  let i = html.indexOf("{", start);
  const open = i;
  for (let depth = 0; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}" && --depth === 0) break;
  }
  return new Function(`return (${html.slice(open, i + 1)});`)();
}

type V1Entry = { title: string; file: string; subtopics: string[] };

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

type Draft = {
  grade: 10 | 11 | 12;
  folder: string;
  title: string;
  description: string;
  entries: V1Entry[];
};

function v1Chapters(): Draft[] {
  const drafts: Draft[] = [];
  const g10 = readJson<{
    chapters: Array<{
      id: string;
      title: string;
      description: string;
      topics: Array<{ file: string; title: string; subtopics: string[] }>;
    }>;
  }>(join(MATERIALS, "grade10", "index.json"));
  for (const c of g10.chapters)
    drafts.push({
      grade: 10,
      folder: c.id,
      title: c.title,
      description: c.description,
      entries: c.topics.map((t) => ({
        ...t,
        file: t.file.replace(/\.json$/, ""),
      })),
    });

  const g11 = readJson<{
    topics: Array<{ id: string; name: string; description: string }>;
  }>(join(MATERIALS, "grade11", "index.json"));
  const g11Files = pageTable("grade11FileMappings");
  for (const t of g11.topics)
    drafts.push({
      grade: 11,
      folder: t.id,
      title: t.name,
      description: t.description,
      entries: g11Files[t.id] ?? [],
    });

  const g12 = readJson<{
    danh_sách_chương: Array<{
      tên: string;
      folder: string;
      nội_dung_chính: string[];
    }>;
  }>(join(MATERIALS, "grade12", "index.json"));
  const g12Files = pageTable("grade12Topics");
  for (const c of g12.danh_sách_chương)
    drafts.push({
      grade: 12,
      folder: c.folder,
      title: c.tên,
      description: c.nội_dung_chính.join(", "),
      entries: g12Files[c.folder] ?? [],
    });

  // Pages that exist but v1's list never linked.
  for (const d of drafts) {
    const dir = join(MATERIALS, `grade${d.grade}`, d.folder);
    if (!existsSync(dir)) continue;
    const listed = new Set(d.entries.map((e) => e.file));
    for (const f of readdirSync(dir)
      .filter((n) => n.endsWith(".html"))
      .sort())
      if (!listed.has(basename(f, ".html")))
        d.entries.push({
          title: "",
          file: basename(f, ".html"),
          subtopics: [],
        });
  }
  return drafts;
}

// ---------------------------------------------------------- external links

const GROUPS: Record<string, string> = {
  lý_thuyết: "Lý thuyết",
  công_thức: "Công thức",
  bài_tập: "Bài tập",
  trắc_nghiệm: "Trắc nghiệm",
  video_bài_giảng: "Video bài giảng",
  tài_liệu_bổ_sung: "Tài liệu bổ sung",
};

const humanize = (key: string) => {
  const text = key.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function chapterLinks(grade: number, folder: string): Link[] {
  const path = join(MATERIALS, `grade${grade}`, folder, "materials.json");
  if (!existsSync(path)) return [];
  const links: Link[] = [];
  const walk = (value: unknown, keys: string[]) => {
    if (Array.isArray(value)) {
      for (const v of value) walk(v, keys);
      return;
    }
    if (!value || typeof value !== "object") return;
    const o = value as Record<string, unknown>;
    if (typeof o.url === "string" && /^https:\/\//.test(o.url)) {
      const group = keys.map((k) => GROUPS[k]).find(Boolean) ?? "Tham khảo";
      const title =
        (typeof o.tiêu_đề === "string" && o.tiêu_đề.trim()) ||
        humanize(keys.at(-1) ?? "Tài liệu");
      links.push({ title, url: o.url, group });
    }
    for (const [k, v] of Object.entries(o))
      if (k !== "url") walk(v, [...keys, k]);
  };
  walk(readJson(path), []);
  return links;
}

// ------------------------------------------------------------- HTML → MDX

const attr = (n: Node, name: string) =>
  n.attrs?.find((a) => a.name === name)?.value;
const tag = (n: Node) => n.tagName ?? n.nodeName;
const kids = (n: Node) => n.childNodes ?? [];

const INLINE = new Set([
  "#text",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "sub",
  "sup",
  "br",
  "a",
  "span",
  "code",
  "small",
  "mark",
  "font",
  "nokr",
]);
const SKIP = new Set([
  "script",
  "style",
  "meta",
  "title",
  "link",
  "noscript",
  "#comment",
  "h1",
]);

/**
 * Text for MDX: `{ } < >` as character references (a backslash does not
 * escape them inside JSX), Markdown punctuation with a backslash.
 */
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;")
    .replace(/[*_`[\]~|$]/g, (c) => `\\${c}`);
}

/** A block must not start like a heading, list item or code. */
const escStart = (text: string) =>
  text.replace(/^(#|-|\+|=)/, "\\$1").replace(/^(\d+)([.)])(\s|$)/, "$1\\$2$3");

/**
 * v1 wrote LaTeX for MathJax as `\(…\)` and `\[…\]`; remark-math reads
 * `$…$` and `$$…$$` (KaTeX on the server via rehype-katex). TeX is kept as is.
 */
function textWithMath(raw: string): string {
  let out = "";
  let last = 0;
  for (const m of raw.matchAll(/\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g)) {
    out += esc(raw.slice(last, m.index).replace(/\s+/g, " "));
    const tex = (m[1] ?? m[2] ?? "").replace(/\s+/g, " ").trim();
    out += m[2] === undefined ? `$${tex}$` : `$$${tex}$$`;
    last = m.index + m[0].length;
  }
  return out + esc(raw.slice(last).replace(/\s+/g, " "));
}

/** A paragraph of display formulas only becomes `$$` blocks on their own lines. */
function displayMath(text: string): string[] | null {
  const parts = text
    .split(/(?:<br \/>|\s)*(\$\$[^$]+\$\$)(?:<br \/>|\s)*/)
    .filter(Boolean);
  if (!parts.length || !parts.every((p) => /^\$\$[^$]+\$\$$/.test(p)))
    return null;
  return parts.map((p) => `$$\n${p.slice(2, -2)}\n$$`);
}

type Ctx = { file: string; resolve: (href: string) => string | null };

function wrapInline(inner: string, md: string, jsx: string): string {
  const lead = /^\s*/.exec(inner)?.[0] ?? "";
  const trail = /\s*$/.exec(inner)?.[0] ?? "";
  const core = inner.trim();
  if (!core) return inner;
  // `**` only when CommonMark's flanking rules can't trip over punctuation.
  const safe = /^[\p{L}\p{N}]/u.test(core) && /[\p{L}\p{N}]$/u.test(core);
  return safe
    ? `${lead}${md}${core}${md}${trail}`
    : `${lead}<${jsx}>${core}</${jsx}>${trail}`;
}

function inline(nodes: Node[], ctx: Ctx): string {
  let out = "";
  for (const n of nodes) {
    const t = tag(n);
    if (t === "#text") out += textWithMath(n.value ?? "");
    else if (SKIP.has(t)) continue;
    else if (t === "br") out += "<br />";
    else if (t === "strong" || t === "b")
      out += wrapInline(inline(kids(n), ctx), "**", "strong");
    else if (t === "em" || t === "i")
      out += wrapInline(inline(kids(n), ctx), "*", "em");
    else if (t === "sub" || t === "sup")
      out += `<${t}>${inline(kids(n), ctx).trim()}</${t}>`;
    else if (t === "a") {
      const text = inline(kids(n), ctx);
      const href = ctx.resolve(attr(n, "href") ?? "");
      out += href && text.trim() ? `[${text.trim()}](${href})` : text;
    } else out += inline(kids(n), ctx);
  }
  return out;
}

const tidy = (text: string) =>
  text
    .replace(/ {2,}/g, " ")
    .replace(/\s*<br \/>\s*/g, "<br />")
    .replace(/^(<br \/>)+|(<br \/>)+$/g, "")
    .trim();

const CALLOUTS: Record<string, string> = {
  "definition-box": "definition",
  "example-box": "example",
  "experiment-box": "example",
  "note-box": "note",
  "application-box": "note",
  "condition-box": "note",
  "special-case": "note",
  "warning-box": "warning",
  safety: "warning",
  "practice-problem": "practice",
  solution: "solution",
  "related-posts": "related",
};

function blocks(nodes: Node[], ctx: Ctx): string[] {
  const out: string[] = [];
  let run: Node[] = [];
  const flush = () => {
    const text = tidy(inline(run, ctx));
    if (text) out.push(...(displayMath(text) ?? [escStart(text)]));
    run = [];
  };
  for (const n of nodes) {
    const t = tag(n);
    if (INLINE.has(t)) {
      run.push(n);
      continue;
    }
    flush();
    if (SKIP.has(t)) continue;
    if (/^h[2-6]$/.test(t)) {
      const level = Math.min(Number(t[1]), 4);
      const text = tidy(inline(kids(n), ctx));
      if (text) out.push(`${"#".repeat(level)} ${text}`);
    } else if (t === "p") {
      const text = tidy(inline(kids(n), ctx));
      if (text) out.push(...(displayMath(text) ?? [escStart(text)]));
    } else if (t === "ul" || t === "ol") {
      const list = listBlock(n, t === "ol", ctx);
      if (list) out.push(list);
    } else if (t === "table") out.push(tableBlock(n, ctx));
    else if (t === "pre") out.push(preBlock(n));
    else if (t === "hr") out.push("---");
    else if (t === "blockquote")
      out.push(
        blocks(kids(n), ctx)
          .join("\n\n")
          .split("\n")
          .map((l) => `> ${l}`.trimEnd())
          .join("\n"),
      );
    else if (t === "div") out.push(...divBlocks(n, ctx));
    else out.push(...blocks(kids(n), ctx)); // section, article, …
  }
  flush();
  return out.filter(Boolean);
}

function divBlocks(n: Node, ctx: Ctx): string[] {
  const classes = (attr(n, "class") ?? "").split(/\s+/);
  const inner = blocks(kids(n), ctx);
  if (!inner.length) return [];
  if (classes.includes("formula-box") || classes.includes("important-formula"))
    return [`<Formula>\n\n${inner.join("\n\n")}\n\n</Formula>`];
  const kind = classes.map((c) => CALLOUTS[c]).find(Boolean);
  if (kind)
    return [`<Callout kind="${kind}">\n\n${inner.join("\n\n")}\n\n</Callout>`];
  return inner;
}

function listBlock(n: Node, ordered: boolean, ctx: Ctx): string {
  const items = kids(n).filter((c) => tag(c) === "li");
  return items
    .map((li, i) => {
      const marker = ordered ? `${i + 1}.` : "-";
      const indent = " ".repeat(marker.length + 1);
      const parts = blocks(kids(li), ctx);
      if (!parts.length) return null;
      return parts
        .map((p, j) => {
          const body = p.replace(/\n/g, `\n${indent}`);
          if (j === 0) return `${marker} ${body}`;
          // A nested list stays tight; other blocks need a blank line.
          const nested = /^(-|\d+\.) /.test(p);
          return `${nested ? "" : "\n"}${indent}${body}`;
        })
        .join("\n");
    })
    .filter((x): x is string => x !== null)
    .join("\n");
}

function tableBlock(n: Node, ctx: Ctx): string {
  const rows: Array<{ head: boolean; cells: string[] }> = [];
  const visit = (node: Node, inHead: boolean) => {
    for (const c of kids(node)) {
      const t = tag(c);
      if (t === "thead") visit(c, true);
      else if (t === "tbody" || t === "tfoot") visit(c, false);
      else if (t === "tr") {
        const cells = kids(c)
          .filter((td) => tag(td) === "td" || tag(td) === "th")
          .map((td) => {
            const spans = ["rowspan", "colspan"]
              .map((a) => {
                const v = attr(td, a);
                return v
                  ? ` ${a === "rowspan" ? "rowSpan" : "colSpan"}={${Number(v)}}`
                  : "";
              })
              .join("");
            const text = tidy(inline(kids(td), ctx)) || "&nbsp;";
            return `<${tag(td)}${spans}>${text}</${tag(td)}>`;
          });
        const allTh = kids(c).every((td) => tag(td) !== "td");
        rows.push({ head: inHead || (rows.length === 0 && allTh), cells });
      }
    }
  };
  visit(n, false);
  const section = (head: boolean) => {
    const rs = rows.filter((r) => r.head === head);
    if (!rs.length) return "";
    const name = head ? "thead" : "tbody";
    return `<${name}>\n${rs.map((r) => `<tr>\n${r.cells.join("\n")}\n</tr>`).join("\n")}\n</${name}>\n`;
  };
  return `<Table>\n${section(true)}${section(false)}</Table>`;
}

function preBlock(n: Node): string {
  const text = (function raw(node: Node): string {
    if (tag(node) === "#text") return node.value ?? "";
    return kids(node).map(raw).join("");
  })(n)
    .replace(/^\n+|\s+$/g, "")
    .replace(/```/g, "ˋˋˋ");
  return `\`\`\`text\n${text}\n\`\`\``;
}

function findTag(root: Node, name: string): Node | null {
  if (tag(root) === name) return root;
  for (const c of kids(root)) {
    const hit = findTag(c, name);
    if (hit) return hit;
  }
  return null;
}

const textOf = (node: Node): string =>
  tag(node) === "#text" ? (node.value ?? "") : kids(node).map(textOf).join("");

// ------------------------------------------------------------------- main

const drafts = v1Chapters();

// v1 path "grade12/song-co-song-am/song_am" → v2 URL.
const urlByLegacy = new Map<string, string>();
for (const d of drafts)
  for (const e of d.entries)
    urlByLegacy.set(
      `grade${d.grade}/${d.folder}/${e.file}`,
      `/ly-thuyet/${d.grade}/${chapterSlug(d.grade, d.folder)}/${topicSlug(e.file)}`,
    );

rmSync(OUT, { recursive: true, force: true });
const grades: Grade[] = [];
let pages = 0;
let brokenLinks = 0;

for (const d of drafts) {
  const chapter: Chapter = {
    slug: chapterSlug(d.grade, d.folder),
    title: d.title,
    description: d.description,
    topics: [],
    links: chapterLinks(d.grade, d.folder),
  };
  for (const e of d.entries) {
    const legacyPath = `grade${d.grade}/${d.folder}/${e.file}`;
    const source = join(MATERIALS, `${legacyPath}.html`);
    if (!existsSync(source)) throw new Error(`Missing v1 page ${source}`);
    const doc = parse(readFileSync(source, "utf8")) as unknown as Node;
    const body = findTag(doc, "body");
    if (!body) throw new Error(`No <body> in ${source}`);
    const ctx: Ctx = {
      file: legacyPath,
      resolve: (href) => {
        if (!href || /^(https?:|mailto:|#)/.test(href)) return null;
        const target = posix
          .normalize(posix.join(posix.dirname(legacyPath), href))
          .replace(/\.html$/, "");
        const url = urlByLegacy.get(target) ?? null;
        if (!url) brokenLinks++;
        return url;
      },
    };
    const h1 = findTag(body, "h1");
    const title =
      e.title ||
      textOf(h1 ?? body)
        .replace(/\s+-\s+Vật lý 1[0-2]$/, "")
        .trim();
    const metaDescription = (function meta(n: Node): string | null {
      if (tag(n) === "meta" && attr(n, "name") === "description")
        return attr(n, "content") ?? null;
      for (const c of kids(n)) {
        const hit = meta(c);
        if (hit) return hit;
      }
      return null;
    })(doc);
    const content = blocks(kids(body), ctx);
    // The first real sentence: no heading, list, box, formula or "…:" lead-in.
    const firstParagraph = content
      .filter((b) => !/^[#<`$-]|^\d+\\?\./.test(b) && !b.includes("$"))
      .find((b) => b.length >= 40 && !b.trimEnd().endsWith(":"))
      ?.replace(/<[^>]+>|[*\\]/g, "")
      .replace(/&#123;/g, "{")
      .replace(/&#125;/g, "}")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
    const description = (metaDescription ?? firstParagraph ?? title)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    const topic: Topic = {
      slug: topicSlug(e.file),
      title,
      description,
      subtopics: e.subtopics,
      legacyPath,
    };
    chapter.topics.push(topic);
    const out = join(OUT, String(d.grade), chapter.slug, `${topic.slug}.mdx`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(
      out,
      `{/* Converted from v1 materials/${legacyPath}.html by scripts/convert-materials.ts (S8-02). */}\n\n${content.join("\n\n")}\n`,
    );
    pages++;
  }
  let grade = grades.find((g) => g.grade === d.grade);
  if (!grade) {
    grade = { grade: d.grade, chapters: [] };
    grades.push(grade);
  }
  grade.chapters.push(chapter);
}

writeFileSync(
  join(OUT, "catalog.ts"),
  `// Generated by scripts/convert-materials.ts from v1 materials (S8-02). Edit
// titles here; page text lives in the .mdx files next to this one.
import type { MaterialCatalog } from "@/features/materials/domain/types";

export const catalog: MaterialCatalog = ${JSON.stringify(grades, null, 2)};
`,
);
console.log(
  `${pages} pages in ${drafts.length} chapters; ${grades
    .flatMap((g) => g.chapters)
    .reduce(
      (n, c) => n + c.links.length,
      0,
    )} external links; ${brokenLinks} links to missing v1 pages dropped.`,
);
