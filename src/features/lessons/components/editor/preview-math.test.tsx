import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { renderMathText, renderTex } from "@/components/math-text/render";
import { mathSegments } from "@/lib/markdown-lite";
import { normalizeV1Questions } from "../../domain/legacy";
import { parseLessonText } from "../../domain/parser";
import { serializeLesson } from "../../domain/serializer";
import type { Question } from "../../schema";
import { PreviewMathText, StaticTex, texKey } from "./preview-math";

vi.mock("@/lib/env.client", () => ({
  clientEnv: { NEXT_PUBLIC_MEDIA_BASE_URL: "https://media.test/m" },
}));
// The action is only called by TexProvider, which these tests don't use.
vi.mock("../../admin-actions", () => ({ renderTexBatch: vi.fn() }));

function textsOf(q: Question): string[] {
  const texts = [q.stem, q.explanation ?? ""];
  if (q.type === "mcq") texts.push(...q.options.map((o) => o.text));
  if (q.type === "tf") texts.push(...q.statements.map((s) => s.text));
  return texts.filter(Boolean);
}

const lessons = JSON.parse(
  readFileSync("tests/fixtures/v1/lessons.json", "utf8"),
) as { title: string; questions: unknown }[];

/**
 * S5-02 acceptance: pasting a v1 lesson's text shows the same questions
 * (no errors) and the preview renders every text exactly as the student
 * pages' server `MathText` does.
 */
describe.each(
  lessons.map((l) => [l.title, l.questions] as const),
)("v1 lesson %s", (_title, raw) => {
  const { questions } = normalizeV1Questions(raw);
  const text = serializeLesson(questions);
  const parsed = parseLessonText(text, { previous: questions });

  it("parses the pasted text back without errors", () => {
    expect(parsed.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(parsed.questions).toEqual(questions);
  });

  it("previews every text identically to the student view", () => {
    const texts = parsed.questions.flatMap(textsOf);
    const cache = new Map<string, string>();
    for (const s of texts.flatMap(mathSegments))
      cache.set(texKey(s.tex, s.display), renderTex(s.tex, s.display));
    for (const t of texts) {
      const preview = renderToStaticMarkup(
        <StaticTex cache={cache}>
          <PreviewMathText text={t} />
        </StaticTex>,
      );
      const student = renderToStaticMarkup(
        <div className="math-text">{renderMathText(t)}</div>,
      );
      expect(preview).toBe(student);
    }
  });
});

describe("PreviewMathText", () => {
  it("shows a formula's source until its HTML arrives", () => {
    const html = renderToStaticMarkup(
      <StaticTex cache={new Map()}>
        <PreviewMathText text="Chu kì $T = 2\pi$" />
      </StaticTex>,
    );
    expect(html).toContain("<code");
    expect(html).toContain("$T = 2\\pi$");
    expect(html).not.toContain("katex");
  });
});
