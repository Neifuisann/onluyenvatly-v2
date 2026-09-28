/**
 * Markdown-lite for question text (06 §4, 07 §4): paragraphs, line breaks,
 * `**bold**`, `*italic*`, `![alt](media:path =WxH)` images and LaTeX math
 * (`$…$`, `$$…$$`, `\(…\)`, `\[…\]`, the delimiters v1 used). Everything else
 * is plain text. Pure: it returns a small AST that MathText renders with React
 * (escaped) and KaTeX.
 */

export type Inline =
  | { t: "text"; v: string }
  | { t: "br" }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "math"; tex: string; display: boolean }
  | {
      t: "image";
      alt: string;
      path: string;
      w: number | undefined;
      h: number | undefined;
    };

export type Paragraph = Inline[];

type Segment =
  | { math: false; v: string }
  | { math: true; tex: string; display: boolean };

/** Split one paragraph into text and math, honouring `\$` escapes. */
export function splitMath(src: string): Segment[] {
  const out: Segment[] = [];
  let text = "";
  let i = 0;
  const flush = () => {
    if (text) out.push({ math: false, v: text });
    text = "";
  };
  const close = (open: number, closer: string, display: boolean): boolean => {
    const end = src.indexOf(closer, open);
    if (end < 0) return false;
    const tex = src.slice(open, end).trim();
    if (!tex) return false;
    flush();
    out.push({ math: true, tex, display });
    i = end + closer.length;
    return true;
  };

  while (i < src.length) {
    const rest = src.slice(i);
    if (rest.startsWith("\\$")) {
      text += "$";
      i += 2;
      continue;
    }
    if (rest.startsWith("$$") && close(i + 2, "$$", true)) continue;
    if (rest.startsWith("\\[") && close(i + 2, "\\]", true)) continue;
    if (rest.startsWith("\\(") && close(i + 2, "\\)", false)) continue;
    if (rest.startsWith("$") && !rest.startsWith("$$")) {
      // Pandoc rule: `$` must hug its content, and the closing `$` must not
      // be followed by a digit, so prices like "5$ và 10$" stay text.
      const m = /^\$(?=\S)((?:\\\$|[^$])*?[^\s\\])\$(?!\d)/.exec(rest);
      if (m?.[1]) {
        flush();
        out.push({ math: true, tex: m[1], display: false });
        i += m[0].length;
        continue;
      }
    }
    text += src[i];
    i += 1;
  }
  flush();
  return out;
}

const INLINE =
  /!\[([^\]\n]*)\]\(media:([A-Za-z0-9][A-Za-z0-9/_.-]*)(?:\s+=(\d+)x(\d+))?\)|(?<![\p{L}\p{N}*])\*\*(?=\S)(.+?)(?<=\S)\*\*(?![\p{L}\p{N}*])|(?<![\p{L}\p{N}*])\*(?=[^\s*])(.+?)(?<=[^\s*])\*(?![\p{L}\p{N}*])/su;

function pushText(out: Inline[], v: string) {
  v.split("\n").forEach((part, i) => {
    if (i > 0) out.push({ t: "br" });
    if (part) out.push({ t: "text", v: part });
  });
}

/** Emphasis, images and line breaks in a non-math run. */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let rest = src;
  for (;;) {
    const m = INLINE.exec(rest);
    if (!m) break;
    pushText(out, rest.slice(0, m.index));
    if (m[2] !== undefined)
      out.push({
        t: "image",
        alt: m[1] ?? "",
        path: m[2],
        w: m[3] ? Number(m[3]) : undefined,
        h: m[4] ? Number(m[4]) : undefined,
      });
    else if (m[5] !== undefined)
      out.push({ t: "strong", c: parseInline(m[5]) });
    else out.push({ t: "em", c: parseInline(m[6] ?? "") });
    rest = rest.slice(m.index + m[0].length);
  }
  pushText(out, rest);
  return out;
}

/** Text → paragraphs (split on blank lines) of inline nodes. */
export function parseMarkdownLite(src: string): Paragraph[] {
  return src
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) =>
      splitMath(p).flatMap((s): Inline[] =>
        s.math
          ? [{ t: "math", tex: s.tex, display: s.display }]
          : parseInline(s.v),
      ),
    );
}
