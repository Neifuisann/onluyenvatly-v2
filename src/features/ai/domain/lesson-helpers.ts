/**
 * Editor helpers (09 AI3/AI4, S7-05): the prompts that write a lesson's
 * description and suggest its tags, and the cleaning of what comes back.
 * Pure. The answers are never sent: the model only needs the topic.
 */
import type { Question } from "../../lessons/schema.ts";

/**
 * Changelog (09 §5):
 * - helpers-v1 (S7-05): description ≤ 60 words; tags reuse known ones.
 */
export const HELPERS_PROMPT_VERSION = "helpers-v1";

/** Stems sent per request: enough to see the topic, cheap on tokens. */
export const DIGEST_MAX_QUESTIONS = 15;
export const DIGEST_MAX_CHARS = 3000;
/** Known tags listed in the prompt, so suggestions reuse the catalog's words. */
export const MAX_KNOWN_TAGS = 60;
/** The settings form's limits (`fromSettingsForm`). */
export const MAX_TAGS = 20;
export const MAX_TAG_CHARS = 50;
export const SUGGESTED_TAGS = 6;
export const MAX_DESCRIPTION_CHARS = 600;
export const HELPERS_MAX_OUTPUT_TOKENS = 1024;
/** Per admin: each click is one Gemini call. */
export const HELPER_CALLS_PER_10_MIN = 20;

export type LessonTopic = {
  title: string;
  grade: number | null;
  chapter: string | null;
  questions: readonly Question[];
};

const oneLine = (s: string) =>
  s
    .replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * The lesson in a few lines: title, grade, chapter and the first stems
 * (no options, no answers), cut at `DIGEST_MAX_CHARS`.
 */
export function lessonDigest(topic: LessonTopic): string {
  const lines = [`Tên bài: ${oneLine(topic.title)}`];
  if (topic.grade) lines.push(`Khối: lớp ${topic.grade}`);
  if (topic.chapter?.trim()) lines.push(`Chương: ${oneLine(topic.chapter)}`);
  const counts = { mcq: 0, tf: 0, short: 0 };
  for (const q of topic.questions) counts[q.type]++;
  lines.push(
    `Số câu: ${topic.questions.length} (trắc nghiệm ${counts.mcq}, đúng/sai ${counts.tf}, trả lời ngắn ${counts.short})`,
    "Một số câu hỏi:",
  );
  let used = lines.join("\n").length;
  for (const [i, q] of topic.questions
    .slice(0, DIGEST_MAX_QUESTIONS)
    .entries()) {
    const stem = oneLine(q.stem) || "(hình)";
    const line = `${i + 1}. ${stem.length > 300 ? `${stem.slice(0, 299)}…` : stem}`;
    if (used + line.length > DIGEST_MAX_CHARS) break;
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join("\n");
}

export const HELPERS_SYSTEM =
  "Bạn là giáo viên Vật lý THPT tại Việt Nam, giúp soạn bài luyện tập trên một trang web ôn thi. Trả lời bằng tiếng Việt, chỉ đưa ra đúng nội dung được yêu cầu, không thêm lời dẫn.";

export function descriptionPrompt(topic: LessonTopic): string {
  return [
    lessonDigest(topic),
    "",
    "Viết một đoạn mô tả ngắn (tối đa 60 từ) cho học sinh đọc trước khi làm bài: bài ôn phần kiến thức nào, gồm những dạng câu hỏi gì, phù hợp khi nào.",
    "Chỉ một đoạn văn thường, không tiêu đề, không gạch đầu dòng, không công thức, không dấu ngoặc kép bao quanh.",
  ].join("\n");
}

export function tagsPrompt(
  topic: LessonTopic,
  known: readonly string[],
): string {
  const lines = [
    lessonDigest(topic),
    "",
    `Gợi ý tối đa ${SUGGESTED_TAGS} thẻ ngắn (1–4 từ, chữ thường) giúp học sinh tìm bài này: chủ đề, dạng bài, mục đích (ví dụ: ôn tập, giữa kì).`,
  ];
  const vocab = known.slice(0, MAX_KNOWN_TAGS);
  if (vocab.length > 0)
    lines.push(
      `Ưu tiên dùng lại đúng các thẻ đã có nếu phù hợp: ${vocab.join(", ")}.`,
    );
  lines.push("Chỉ trả về các thẻ, cách nhau bằng dấu phẩy, trên một dòng.");
  return lines.join("\n");
}

/** One plain paragraph: no markdown, no wrapping quotes, capped. */
export function cleanDescription(text: string): string {
  const unquote = (s: string) =>
    s
      .trim()
      .replace(/^["“”'«]+|["“”'»]+$/g, "")
      .trim();
  const cleaned = unquote(
    unquote(text)
      .replace(/\r\n?/g, "\n")
      .replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, "")
      .replace(/^[ \t]*(#{1,6}|[-*•]|\d+[.)])[ \t]+/gm, "")
      .replace(/\*\*|__|`/g, "")
      .replace(/\s+/g, " "),
  );
  if (cleaned.length <= MAX_DESCRIPTION_CHARS) return cleaned;
  const cut = cleaned.slice(0, MAX_DESCRIPTION_CHARS - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 200 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

const tagKey = (t: string) =>
  t.normalize("NFC").toLocaleLowerCase("vi").replace(/\s+/g, " ").trim();

/**
 * The model's tags: split on commas, semicolons or lines, list markers and
 * quotes stripped, lower case, at most `SUGGESTED_TAGS`. A tag the catalog
 * already has keeps the catalog's spelling.
 */
export function parseTags(text: string, known: readonly string[]): string[] {
  const knownByKey = new Map(known.map((t) => [tagKey(t), t]));
  const out = new Map<string, string>();
  for (const raw of text.split(/[,;\n]/)) {
    const tag = raw
      .replace(/^[ \t]*(#{1,6}|[-*•]|\d+[.)])[ \t]*/, "")
      .replace(/[*_`"“”'«»#]/g, "")
      .replace(/\.+$/, "");
    const key = tagKey(tag);
    if (!key || key.length > MAX_TAG_CHARS || out.has(key)) continue;
    out.set(key, knownByKey.get(key) ?? key);
    if (out.size >= SUGGESTED_TAGS) break;
  }
  return [...out.values()];
}

/**
 * Suggested tags added to the ones in the form (as typed, comma-separated),
 * without duplicates and within the form's limits. Returns the new field
 * value and how many were added.
 */
export function mergeTags(
  current: string,
  suggested: readonly string[],
): { value: string; added: number } {
  const tags = current
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const seen = new Set(tags.map(tagKey));
  let added = 0;
  for (const tag of suggested) {
    if (tags.length >= MAX_TAGS) break;
    const key = tagKey(tag);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    added++;
  }
  return { value: tags.join(", "), added };
}
