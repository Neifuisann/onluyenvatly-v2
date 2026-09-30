import { existsSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { normalizeV1Questions } from "@/features/lessons/domain/legacy";
import type { Question } from "@/features/lessons/schema";
import { renderMathText, renderTex } from "./render";

vi.mock("@/lib/env.client", () => ({
  clientEnv: { NEXT_PUBLIC_MEDIA_BASE_URL: "https://media.test/m" },
}));

const html = (text: string) => renderToStaticMarkup(renderMathText(text));

/** Every piece of text a question can show. */
function textsOf(q: Question): string[] {
  const texts = [q.stem, q.explanation ?? ""];
  if (q.type === "mcq") texts.push(...q.options.map((o) => o.text));
  if (q.type === "tf") texts.push(...q.statements.map((s) => s.text));
  return texts.filter(Boolean);
}

function fixtureQuestions(): Question[] {
  return [
    "tests/fixtures/v1-sample/lessons.json",
    "tests/fixtures/v1/lessons.json",
  ]
    .filter((p) => existsSync(p))
    .flatMap(
      (p) => JSON.parse(readFileSync(p, "utf8")) as { questions: unknown }[],
    )
    .flatMap((l) => normalizeV1Questions(l.questions).questions);
}

describe("renderMathText", () => {
  it("renders paragraphs, breaks, emphasis and math", () => {
    const out = html("**Chu kì** $T = 2\\pi$\ndòng 2\n\nĐoạn *2*");
    expect(out).toMatch(
      /^<p><strong>Chu kì<\/strong> <span class="math-inline"><span class="katex">/,
    );
    expect(out).toContain("<br/>dòng 2</p><p>Đoạn <em>2</em></p>");
    expect(out).toContain("<math");
  });

  it("renders display math as a block", () => {
    expect(html("$$v = \\omega A$$")).toContain('class="math-display"');
    expect(html("$$v = \\omega A$$")).toContain("katex-display");
  });

  it("escapes HTML in text", () => {
    const out = html('<script>alert(1)</script><img src=x onerror="y">');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;script&gt;");
  });

  it("renders media images with size, lazily, from the media bucket", () => {
    expect(html("![Hình 1](media:2026/09/a.webp =640x360)")).toBe(
      '<p><img src="https://media.test/m/2026/09/a.webp" alt="Hình 1" width="640" height="360" loading="lazy" decoding="async" class="my-2 inline-block h-auto max-w-full rounded-md"/></p>',
    );
  });
});

describe("renderTex (KaTeX, trust: false)", () => {
  it("doesn't emit links, images or raw HTML from untrusted commands", () => {
    const out = renderTex(
      "\\href{javascript:alert(1)}{x} \\url{javascript:y} \\includegraphics{https://e/a.png} \\htmlId{a}{b}",
      false,
    );
    // The MathML <annotation> echoes the source as escaped text; ignore it.
    const rendered = out.replace(/<annotation[\s\S]*?<\/annotation>/, "");
    expect(rendered).not.toMatch(/<a\s|href=|<img|javascript:|id="a"/);
  });

  it("shows invalid LaTeX as an error instead of throwing", () => {
    expect(renderTex("\\frac{1}{", false)).toContain("katex-error");
  });

  it("bounds macro expansion", () => {
    const bomb = "\\def\\a{\\a\\a}\\a";
    expect(() => renderTex(bomb, false)).not.toThrow();
  });
});

describe("fixture texts (S2-04 acceptance)", () => {
  const questions = fixtureQuestions();

  it("has fixture questions to render", () => {
    expect(questions.length).toBeGreaterThan(5);
  });

  it("renders every fixture stem, option and explanation without KaTeX errors", () => {
    for (const q of questions)
      for (const text of textsOf(q)) {
        const out = html(text);
        expect(out, text).not.toContain("katex-error");
        if (/\$|\\\(|\\\[/.test(text)) expect(out, text).toContain("katex");
      }
  });
});
