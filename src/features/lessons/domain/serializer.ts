/**
 * `Question[]` → text format (04 §3.3). The inverse of `parseLessonText`:
 * `parse(serialize(qs), { previous: qs }).questions` equals `qs` for every
 * valid lesson (property-tested). Used to regenerate `source_text` for
 * migrated lessons and to open JSON-only content in the editor.
 */
import type { Media, Question } from "../schema.ts";
import { escapeLine, formatNumber, TRAILING_POINTS } from "./text-format.ts";

function imageLine(m: Media): string {
  const size = m.w !== undefined && m.h !== undefined ? ` =${m.w}x${m.h}` : "";
  return `![${m.alt ?? ""}](media:${m.path}${size})`;
}

/**
 * A marker line (`Câu 1:`, `A.`, `a)`) followed by the element's text. The
 * first text line shares the marker line unless it would be misread there.
 */
function block(marker: string, text: string, keepFirst: boolean): string[] {
  const [first = "", ...rest] = text.split("\n");
  const head = keepFirst && first ? `${marker} ${first}` : marker;
  const body = keepFirst ? rest : [first, ...rest].filter((l, i) => i > 0 || l);
  return [head, ...body.map((l) => escapeLine(l, "body"))];
}

export function serializeQuestion(q: Question, index: number): string {
  const [firstStemLine = ""] = q.stem.split("\n");
  // A trailing `[x pts]` on the header line would be read as points.
  const lines = block(
    `Câu ${index + 1}:`,
    q.stem,
    !TRAILING_POINTS.test(firstStemLine),
  );
  if (q.image) lines.push(imageLine(q.image));

  switch (q.type) {
    case "mcq":
      q.options.forEach((o, i) => {
        const letter = String.fromCharCode(65 + i);
        const star = i === q.answer ? "*" : "";
        lines.push(...block(`${star}${letter}.`, o.text, true));
        if (o.image) lines.push(imageLine(o.image));
      });
      break;
    case "tf":
      q.statements.forEach((s, i) => {
        const letter = String.fromCharCode(97 + i);
        lines.push(...block(`${s.answer ? "*" : ""}${letter})`, s.text, true));
      });
      break;
    case "short": {
      const tolerance =
        q.tolerance !== undefined ? ` ± ${formatNumber(q.tolerance)}` : "";
      lines.push(`Answer: ${q.answer}${tolerance}`);
      break;
    }
  }

  if (q.points !== undefined) lines.push(`[${formatNumber(q.points)} pts]`);
  if (q.free) lines.push("[Tặng điểm]");
  if (q.explanation) {
    const [first = "", ...rest] = q.explanation.split("\n");
    lines.push(
      `Giải thích: ${first}`,
      ...rest.map((l) => escapeLine(l, "explanation")),
    );
  }
  return lines.join("\n");
}

/** Removed questions (B-10) stay in the stored JSON only, never in the text. */
export function serializeLesson(questions: readonly Question[]): string {
  return questions
    .filter((q) => !q.removed)
    .map(serializeQuestion)
    .join("\n\n");
}
