/**
 * AI import (09 AI2, S7-04): which files are accepted, where they are kept,
 * the prompt that turns an exam into the editor's text format (04 §3.3),
 * DOCX HTML to text, and cleaning the model's output. Pure.
 */

import { classifyLine } from "../../lessons/domain/text-format.ts";

/**
 * Changelog (09 §5):
 * - import-v1 (S7-04): format spec + two worked examples; `*` only where the
 *   source shows the answer; figures as `[Hình]` placeholders (PDF/image) or
 *   kept `media:` lines (DOCX).
 * - import-v2 (2026-10-07): a shared passage ("Sử dụng thông tin sau cho
 *   Câu 3 và Câu 4") is copied into every question that uses it, tables
 *   become ` | ` lines, "Cho biết" constants go to the questions that need
 *   them, numbering runs on across parts; when the exam has a key the model
 *   first copies it on an `ĐÁP ÁN:` line (dropped by `cleanImportText`,
 *   with anything else before `Câu 1`) and marks answers from it; a table
 *   goes before the options; a third worked example. On the
 *   2025 THPT reference exam v1 dropped all five shared passages, the data
 *   table and the constants, leaving questions that could not be answered.
 */
export const IMPORT_PROMPT_VERSION = "import-v2";

/** 09 §4: PDF, DOCX or an image, at most 10 MB. */
export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;
/** A whole exam; thinking counts too. */
export const IMPORT_MAX_OUTPUT_TOKENS = 32_768;
/** Uploads and imports per admin per hour (each import is one long call). */
export const IMPORTS_PER_HOUR = 10;
/** 09 §4: uploads are deleted after a day (daily cron). */
export const IMPORT_TTL_MS = 24 * 60 * 60 * 1000;

export type ImportKind = "pdf" | "docx" | "image";

export const IMPORT_TYPES = {
  "application/pdf": { kind: "pdf", ext: "pdf" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    kind: "docx",
    ext: "docx",
  },
  "image/png": { kind: "image", ext: "png" },
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/webp": { kind: "image", ext: "webp" },
} as const satisfies Record<string, { kind: ImportKind; ext: string }>;

export type ImportContentType = keyof typeof IMPORT_TYPES;
export const IMPORT_CONTENT_TYPES = Object.keys(
  IMPORT_TYPES,
) as ImportContentType[];

/** `imports` bucket path: `YYYY/MM/<uuid>.<ext>` (UTC month). */
export function importObjectPath(
  now: Date,
  id: string,
  contentType: ImportContentType,
): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}/${m}/${id}.${IMPORT_TYPES[contentType].ext}`;
}

export const IMPORT_PATH_PATTERN =
  /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.(pdf|docx|png|jpg|webp)$/;

/** Month folders the cleanup lists: this month's and the previous one. */
export function importFolders(now: Date): string[] {
  const at = (d: Date) =>
    `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const prev = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  return [at(prev), at(now)];
}

export type Sniffed =
  | { kind: "pdf"; mimeType: "application/pdf" }
  | { kind: "docx" }
  | { kind: "image"; mimeType: "image/png" | "image/jpeg" | "image/webp" };

const startsWith = (b: Uint8Array, sig: readonly number[], at = 0) =>
  sig.every((x, i) => b[at + i] === x);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/**
 * What the file really is, from its first bytes: the declared type is the
 * browser's word only. A DOCX is a zip; mammoth rejects any other zip.
 */
export function sniffImport(bytes: Uint8Array): Sniffed | null {
  if (startsWith(bytes, ascii("%PDF-")))
    return { kind: "pdf", mimeType: "application/pdf" };
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return { kind: "docx" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { kind: "image", mimeType: "image/png" };
  if (startsWith(bytes, [0xff, 0xd8, 0xff]))
    return { kind: "image", mimeType: "image/jpeg" };
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8))
    return { kind: "image", mimeType: "image/webp" };
  return null;
}

/** A lesson title from the file name: no extension, `_`/`-` as spaces. */
export function importTitle(fileName: string): string {
  const base = fileName
    .replace(/\.[A-Za-z0-9]{1,5}$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (base || "Bài nhập từ file").slice(0, 200);
}

const EXAMPLE_SOURCE = `Câu 1. Một vật dao động điều hoà với phương trình x = 5cos(2πt) cm. Biên độ dao động là
A. 2 cm.   B. 5 cm.   C. 10 cm.   D. 2π cm.
Câu 2. Cho con lắc lò xo dao động điều hoà. Mỗi ý a), b), c), d) chọn đúng hoặc sai.
a) Chu kì phụ thuộc vào khối lượng vật.
b) Chu kì phụ thuộc vào biên độ.
c) Cơ năng tỉ lệ với bình phương biên độ.
d) Tần số tăng khi tăng khối lượng.
Câu 3. Tính chu kì (s) của con lắc có k = 100 N/m, m = 1 kg (làm tròn đến hai chữ số thập phân).
ĐÁP ÁN: 1B; 2: a Đ, b S, c Đ, d S; 3: 0,63`;

const EXAMPLE_OUTPUT = `ĐÁP ÁN: 1B; 2: a Đ, b S, c Đ, d S; 3: 0,63

Câu 1: Một vật dao động điều hoà với phương trình $x = 5\\cos(2\\pi t)$ cm. Biên độ dao động là
A. 2 cm
*B. 5 cm
C. 10 cm
D. $2\\pi$ cm

Câu 2: Cho con lắc lò xo dao động điều hoà.
*a) Chu kì phụ thuộc vào khối lượng vật.
b) Chu kì phụ thuộc vào biên độ.
*c) Cơ năng tỉ lệ với bình phương biên độ.
d) Tần số tăng khi tăng khối lượng.

Câu 3: Tính chu kì (s) của con lắc có $k = 100$ N/m, $m = 1$ kg (làm tròn đến hai chữ số thập phân).
Answer: 0,63`;

const EXAMPLE2_SOURCE = `Câu 4: Quan sát đồ thị ở Hình 1. Đơn vị của tần số là
(Hình 1)
A. s B. Hz C. m/s D. rad
Câu 5: Gia tốc trọng trường lấy g = 9,8 m/s². Tính chu kì con lắc đơn dài 1 m.`;

const EXAMPLE2_OUTPUT = `Câu 1: Quan sát đồ thị ở Hình 1. Đơn vị của tần số là
[Hình]
A. s
B. Hz
C. m/s
D. rad

Câu 2: Gia tốc trọng trường lấy $g = 9{,}8$ m/s². Tính chu kì con lắc đơn dài 1 m.
Answer:`;

const EXAMPLE3_SOURCE = `Cho biết: π = 3,14; g = 9,8 m/s².
Sử dụng thông tin sau cho Câu 7 và Câu 8: Một con lắc đơn dài 1,0 m dao động nhỏ. Bảng bên ghi thời gian 10 dao động toàn phần.
(bảng) Lần đo: 1, 2, 3 — t (s): 20,1; 20,0; 19,9
Câu 7. Chu kì trung bình của con lắc là
A. 2,0 s. B. 1,0 s. C. 20 s. D. 0,5 s.
Câu 8. Tính gia tốc trọng trường đo được (m/s², làm tròn đến hàng phần mười).
ĐÁP ÁN: 7A; 8: 9,9`;

const EXAMPLE3_SHARED = `Một con lắc đơn dài 1,0 m dao động nhỏ. Bảng bên ghi thời gian 10 dao động toàn phần.
Lần đo | 1 | 2 | 3
t (s) | 20,1 | 20,0 | 19,9`;

const EXAMPLE3_OUTPUT = `ĐÁP ÁN: 7A; 8: 9,9

Câu 1: ${EXAMPLE3_SHARED}
Chu kì trung bình của con lắc là
*A. 2,0 s
B. 1,0 s
C. 20 s
D. 0,5 s

Câu 2: ${EXAMPLE3_SHARED}
Tính gia tốc trọng trường đo được (m/s², làm tròn đến hàng phần mười).
Cho biết: $\\pi = 3{,}14$.
Answer: 9,9`;

/** The worked examples in the prompt; a test checks they parse. */
export const IMPORT_EXAMPLE_OUTPUTS = [
  EXAMPLE_OUTPUT,
  EXAMPLE2_OUTPUT,
  EXAMPLE3_OUTPUT,
] as const;

/** 09 §4: the exact format, three worked examples, and the guardrails. */
export const IMPORT_SYSTEM = [
  "Bạn chuyển đề kiểm tra Vật lý (tiếng Việt) sang định dạng văn bản của trang web ôn thi. Chỉ trả về văn bản theo định dạng, không lời dẫn, không bọc trong ```.",
  "",
  "ĐỊNH DẠNG:",
  "- Nếu đề có bảng đáp án: dòng ĐẦU TIÊN bạn viết là `ĐÁP ÁN: …`, chép lại nguyên bảng đáp án theo từng phần. Sau đó đánh dấu đáp án từng câu theo đúng dòng này. Đề không có đáp án thì không viết dòng này. Mọi thứ viết trước `Câu 1:` (kể cả dòng này) sẽ bị XOÁ, nên không đặt gì khác ở đó.",
  "- Mỗi câu bắt đầu bằng một dòng `Câu N: <đề bài>`, đánh số liên tục 1, 2, 3… qua mọi phần của đề (không đánh lại từ 1 ở mỗi phần). Đề dài có thể xuống dòng.",
  "- Đoạn thông tin dùng chung cho nhiều câu (ví dụ `Sử dụng thông tin sau cho Câu 3 và Câu 4: …`): chép NGUYÊN VĂN đoạn đó vào đầu đề bài của TỪNG câu dùng nó, bỏ cụm `Sử dụng thông tin sau cho…`. Mỗi câu được hiển thị riêng và có thể bị xáo trộn, nên không bao giờ được bỏ đoạn này.",
  "- Bảng số liệu (kể cả bảng nhỏ nằm cạnh hình, ví dụ bảng `Lần đo | V (cm³) | p (bar)`): bảng là chữ, không phải hình, nên phải chép đủ vào đề bài, mỗi hàng một dòng, các ô cách nhau bằng ` | `, hàng đầu là tiêu đề cột. Đặt bảng TRƯỚC dòng `A.` hoặc `a)` đầu tiên của câu: dòng nằm sau một phương án/phát biểu sẽ bị coi là phần tiếp theo của phương án/phát biểu đó.",
  "- Dữ kiện chung của cả đề (ví dụ `Cho biết: π = 3,14; R = 8,31 J.mol⁻¹.K⁻¹`): KHÔNG đặt ở đầu bài (sẽ bị xoá); thay vào đó chép NGUYÊN dòng `Cho biết: …` vào cuối đề bài (trước phương án/phát biểu/`Answer:`) của TỪNG câu có tính toán dùng đến bất kì giá trị nào trong đó (ví dụ câu tính số mol, số phân tử, nhiệt độ). Không chắc thì cứ chép.",
  "- Trắc nghiệm nhiều lựa chọn: mỗi phương án một dòng `A. …`, `B. …` (tối đa A–F). Đặt `*` ngay trước chữ cái của phương án đúng: `*B. …`.",
  "- Đúng/Sai: mỗi phát biểu một dòng `a) …`, `b) …` (tối đa a–h). Đặt `*` trước phát biểu ĐÚNG: `*a) …`; phát biểu sai để nguyên.",
  "- Trả lời ngắn: một dòng `Answer: <đáp số>` (dấu phẩy thập phân như trong đề).",
  "- Lời giải của đề (nếu đề có): một dòng `Giải thích: …` ở cuối câu.",
  "- Điểm riêng của câu (chỉ khi đề ghi rõ): một dòng `[0.25 pts]`.",
  "- Công thức viết bằng LaTeX trong `$…$`. Giữ nguyên số liệu và đơn vị.",
  "- Hình vẽ: nếu gặp dòng `![](media:…)` thì giữ nguyên đúng vị trí; nếu đề có hình mà bạn không chép được thì ghi một dòng `[Hình]` ngay dưới đề bài của câu đó (trước các phương án).",
  "- Một dòng trống giữa hai câu. Bỏ tiêu đề đề thi, hướng dẫn làm bài (`PHẦN I. Thí sinh trả lời…`), số trang, mã đề, họ tên/số báo danh; nhưng giữ mọi dữ kiện câu hỏi cần (đoạn dùng chung, bảng, hằng số).",
  "",
  "QUY TẮC:",
  "- Chỉ đánh dấu `*` hoặc ghi đáp số khi đề THỂ HIỆN đáp án (bảng đáp án, phương án được tô/gạch chân, lời giải). Nếu đề không có đáp án thì KHÔNG đoán: để không có `*`, và `Answer:` để trống.",
  "- Khi đề có bảng đáp án: đáp án từng câu phải khớp ĐÚNG Y dòng `ĐÁP ÁN:` bạn đã chép, kể cả khi bạn tự tính ra kết quả khác; không tự giải để chọn đáp án. Đúng/Sai trong bảng (`Câu 4. a Đúng b Sai c Đúng d Sai`): `Đúng` → có `*`, `Sai` → không có `*`. Lưu ý mỗi PHẦN của đề đánh số câu riêng: `Câu 1` của phần Đúng/Sai ứng với câu Đúng/Sai đầu tiên.",
  "- Không thêm, bớt hay sửa nội dung câu hỏi. Không tự viết lời giải.",
  "- Mỗi câu phải đủ dữ kiện để làm được khi đứng một mình. Trước khi trả lời, kiểm tra lại: câu nào dựa vào đoạn dùng chung, bảng hay hằng số mà thiếu thì chép bổ sung.",
  "",
  "VÍ DỤ 1 (đề có bảng đáp án ở cuối):",
  EXAMPLE_SOURCE,
  "=>",
  EXAMPLE_OUTPUT,
  "",
  "VÍ DỤ 2 (đề không có đáp án, có hình):",
  EXAMPLE2_SOURCE,
  "=>",
  EXAMPLE2_OUTPUT,
  "",
  "VÍ DỤ 3 (đoạn thông tin dùng chung, bảng số liệu, dữ kiện chung):",
  EXAMPLE3_SOURCE,
  "=>",
  EXAMPLE3_OUTPUT,
].join("\n");

/** The user turn: the file goes alongside as inline data, or the DOCX text. */
export function importPrompt(docText?: string): string {
  const task = "Chuyển đề sau sang định dạng trên, giữ đúng thứ tự các câu.";
  return docText === undefined
    ? `${task} Đề nằm trong file đính kèm.`
    : `${task}\n\n${docText}`;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code =
        e[1] === "x" || e[1] === "X"
          ? Number.parseInt(e.slice(2), 16)
          : Number.parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000
        ? String.fromCodePoint(code)
        : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/**
 * mammoth's HTML as plain lines for the prompt: paragraphs, list items and
 * table rows become lines (cells joined by ` | `), `<img src="media:…">`
 * becomes its own `![](media:…)` line, other tags go. Images mammoth could
 * not keep (`src` not `media:`) become `[Hình]`.
 */
export function htmlToLessonText(html: string): string {
  const text = html
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const src = tag.match(/\bsrc="([^"]*)"/i)?.[1] ?? "";
      const path = src.startsWith("media:") ? src.slice(6) : "";
      return /^[A-Za-z0-9][A-Za-z0-9/_.-]*$/.test(path)
        ? `\n![](media:${path})\n`
        : "\n[Hình]\n";
    })
    .replace(/<\/(td|th)>\s*<(td|th)\b[^>]*>/gi, " | ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|tr|h[1-6]|table|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A question header as the parser reads it: `Câu 1:` or `Câu 1. `. */
const QUESTION_HEADER = /^[ \t]*câu[ \t]*\d+[ \t]*[:.]/imu;
/** A table row as the prompt asks for it: cells joined by ` | `. */
const TABLE_ROW = /\S[ \t]+\|[ \t]+\S/;

const kindOf = (line: string) => classifyLine(line.trim()).kind;

/**
 * One question's lines with its table rows moved up into the stem, before
 * the first option or statement: models copy a table where it sits on the
 * page (often beside the statements), but below an option the parser would
 * read it as part of that option. A `Giải thích:` block is left alone.
 */
function liftTableRows(lines: string[]): string[] {
  const first = lines.findIndex((l) =>
    ["option", "statement"].includes(kindOf(l)),
  );
  if (first < 0) return lines;
  const explanation = lines.findIndex((l) => kindOf(l) === "explanation");
  const end = explanation < 0 ? lines.length : explanation;
  const rows: string[] = [];
  const rest: string[] = [];
  lines.forEach((l, i) => {
    const row = i > first && i < end && kindOf(l) === "text";
    (row && TABLE_ROW.test(l) ? rows : rest).push(l);
  });
  if (rows.length === 0) return lines;
  return [...rest.slice(0, first), ...rows, ...rest.slice(first)];
}

const isQuestionPart = (line: string) =>
  ["option", "statement", "answer"].includes(kindOf(line));

/**
 * Text before the first `Câu N:`: paragraphs without options, statements or
 * an `Answer:` line (the `ĐÁP ÁN:` line the prompt asks for first, a
 * preamble) are dropped; a paragraph that is a question whose header the
 * model left out gets one, so the question is kept.
 */
function rescuePreamble(preamble: string): string {
  return preamble
    .split(/\n[ \t]*\n/)
    .filter((p) => p.split("\n").some(isQuestionPart))
    .map((p) => `Câu 1: ${p.trim()}\n\n`)
    .join("");
}

/**
 * The model's text as the editor takes it: without a wrapping code fence,
 * with Unix line ends and at most one blank line in a row, starting at the
 * first question (see `rescuePreamble`), and with each table in its
 * question's stem.
 */
export function cleanImportText(text: string): string {
  const unfenced = text
    .replace(/\r\n?/g, "\n")
    .replace(/^\s*```[a-zA-Z]*[ \t]*\n/, "")
    .replace(/\n```\s*$/, "");
  const first = unfenced.search(QUESTION_HEADER);
  const body =
    first > 0
      ? rescuePreamble(unfenced.slice(0, first)) + unfenced.slice(first)
      : unfenced;
  const questions: string[][] = [];
  for (const line of body.split("\n")) {
    if (kindOf(line) === "header" || questions.length === 0) questions.push([]);
    questions.at(-1)?.push(line);
  }
  return questions
    .flatMap(liftTableRows)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
