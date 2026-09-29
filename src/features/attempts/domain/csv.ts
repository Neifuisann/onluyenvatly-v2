/**
 * CSV for spreadsheets (S6-04 results export). Pure. RFC 4180: comma
 * separated, CRLF line ends, a field with a comma, quote or line break is
 * quoted and its quotes doubled. UTF-8 with a BOM so Excel reads Vietnamese.
 * A text cell that a spreadsheet would run as a formula (starting with
 * `= + - @`, a tab or a carriage return) gets a leading `'` (OWASP CSV
 * injection); numbers are written as they are.
 */
import { formatDateTime, vnDateKey } from "@/lib/dates";

/** U+FEFF, which Excel needs to read the file as UTF-8. */
export const BOM = String.fromCharCode(0xfeff);

export type CsvValue = string | number | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : "";
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Header plus rows, BOM first, CRLF after every line. */
export function toCsv(
  header: readonly string[],
  rows: readonly (readonly CsvValue[])[],
): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(","));
  return `${BOM}${lines.map((l) => `${l}\r\n`).join("")}`;
}

export const RESULTS_CSV_HEADER = [
  "Họ tên",
  "Lớp",
  "Khối",
  "Bài",
  "Điểm (/10)",
  "Điểm",
  "Tối đa",
  "Thời gian (giây)",
  "Nộp lúc",
  "Cảnh báo",
] as const;

/** One exported attempt. No phone or date of birth (06 §5). */
export type ResultCsvRow = {
  fullName: string;
  className: string | null;
  grade: number | null;
  /** null for personalized practice. */
  lessonTitle: string | null;
  score10: number | null;
  score: number | null;
  maxScore: number;
  timeTakenSec: number | null;
  submittedAt: Date | null;
  guardCount: number;
};

/**
 * The results CSV: scores with a `.` decimal (the file is data, not
 * display), submission time as `dd/mm/yyyy hh:mm` in Vietnam time.
 */
export function resultsCsv(
  rows: readonly ResultCsvRow[],
  reviewTitle: string,
): string {
  return toCsv(
    RESULTS_CSV_HEADER,
    rows.map((r) => [
      r.fullName,
      r.className,
      r.grade,
      r.lessonTitle ?? reviewTitle,
      r.score10,
      r.score,
      r.maxScore,
      r.timeTakenSec,
      r.submittedAt ? formatDateTime(r.submittedAt) : null,
      r.guardCount,
    ]),
  );
}

/** `ket-qua-2026-10-01.csv`, the Vietnam date of the export. */
export function exportFilename(now: Date): string {
  return `ket-qua-${vnDateKey(now)}.csv`;
}
