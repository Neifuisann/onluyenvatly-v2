/**
 * Physics topic of a lesson, guessed from its chapter (or title) so cards can
 * show a matching glyph and color (07 §3.4: no stock photos). Pure; the first
 * matching rule wins, so specific phrases come before general ones
 * ("dao động điện từ" is an oscillation, "dòng điện" is not electrostatics).
 */
export type Topic =
  | "oscillation"
  | "wave"
  | "current"
  | "magnetic"
  | "electric"
  | "optics"
  | "thermal"
  | "nuclear"
  | "kinematics"
  | "dynamics"
  | "energy"
  | "review"
  | "general";

const RULES: readonly [Topic, readonly string[]][] = [
  ["oscillation", ["dao dong", "con lac"]],
  ["wave", ["song", "am thanh", "giao thoa"]],
  ["current", ["dong dien", "mach dien", "dien tro", "nguon dien"]],
  ["magnetic", ["tu truong", "cam ung", "tu thong", "dien tu", "nam cham"]],
  ["electric", ["dien truong", "dien tich", "tu dien", "dien the", "dien"]],
  [
    "optics",
    ["quang", "anh sang", "khuc xa", "phan xa", "thau kinh", "lang kinh"],
  ],
  ["thermal", ["nhiet", "chat khi", "khi ly tuong", "khi li tuong"]],
  ["nuclear", ["hat nhan", "phong xa", "luong tu", "nguyen tu"]],
  ["kinematics", ["dong hoc", "chuyen dong", "van toc", "roi tu do"]],
  ["dynamics", ["dong luc", "luc", "newton"]],
  ["energy", ["nang luong", "cong suat", "dong luong", "co nang"]],
  ["review", ["on tap", "de thi", "kiem tra", "giua ki", "cuoi ki", "thi thu"]],
];

/** Lowercase, no Vietnamese diacritics, single spaces. */
export function foldVietnamese(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function matches(folded: string, phrase: string): boolean {
  // Whole words only: "luc" must not match inside "lucky".
  return new RegExp(`(^|[^a-z])${phrase}($|[^a-z])`).test(folded);
}

export function lessonTopic(chapter: string | null, title = ""): Topic {
  for (const source of [chapter ?? "", title]) {
    const folded = foldVietnamese(source);
    if (!folded) continue;
    for (const [topic, phrases] of RULES) {
      if (phrases.some((p) => matches(folded, p))) return topic;
    }
  }
  return "general";
}
