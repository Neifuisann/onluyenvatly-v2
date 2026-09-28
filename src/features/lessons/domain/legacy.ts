/**
 * v1 → v2 lesson normalization (10 §3–4). Pure: the migration script does the
 * I/O (reading v1, copying media) and uses these to shape rows.
 *
 * v1 stores questions as loose JSON: `{ id?, question, type, options, correct,
 * points }` with types abcd/multiple_choice, truefalse/true_false,
 * number/fill_blank (and a few essays), images as `[img src="URL"]` inside the
 * text, and points baked into each question at save time.
 */
import {
  DEFAULT_LESSON_CONFIG,
  type LessonConfig,
  LessonConfigSchema,
  type Media,
  type Question,
  QuestionIdSchema,
  QuestionSchema,
  type QuestionType,
} from "../schema.ts";
import { canonicalShortAnswer, normalizeInput } from "./text-format.ts";

export type LegacyProblem = {
  /** Index in the v1 `questions` array, when it concerns one question. */
  index?: number;
  severity: "error" | "warning";
  message: string;
};

/** Maps a v1 image URL to a path in the v2 `media` bucket, or null if it can't be migrated. */
export type MediaMapper = (url: string) => string | null;

type Json = Record<string, unknown>;

const TYPE_MAP: Record<string, QuestionType> = {
  abcd: "mcq",
  multiple_choice: "mcq",
  truefalse: "tf",
  true_false: "tf",
  number: "short",
  fill_blank: "short",
};

const V1_BUCKET_URL = /\/storage\/v1\/object\/public\/lesson-images\/(.+)$/;

/**
 * v1 Supabase `lesson-images` URLs → `legacy/<file>` (10 §3). Other URLs
 * (external hosts, data URLs) aren't migrated automatically.
 */
export function defaultV1MediaPath(url: string): string | null {
  const m = V1_BUCKET_URL.exec(url.split("?")[0] ?? "");
  if (!m?.[1]) return null;
  let name: string;
  try {
    name = decodeURIComponent(m[1]);
  } catch {
    name = m[1];
  }
  const safe = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    // đ/Đ have no NFD decomposition.
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9/_.-]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[^A-Za-z0-9]+/, "");
  return safe ? `legacy/${safe}` : null;
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/** `<br>` → newline, other tags dropped, lines trimmed (10 §4). */
export function cleanLegacyText(raw: string): {
  text: string;
  hadHtml: boolean;
} {
  let s = normalizeInput(raw);
  const hadHtml = /<\/?[a-z][^>]*>/i.test(s);
  s = s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e] ?? e);
  const text = s
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, hadHtml };
}

const IMG_TAG = /\[img\s+src\s*=\s*"([^"]+)"\s*\]/gi;
const POINTS_MARKER = /\s*\[\s*(\d+(?:[.,]\d+)?)\s*pts?\s*\]/gi;

/** Pull `[img src="…"]` tags out of a text; the first becomes the element's image. */
function extractImages(text: string): { text: string; urls: string[] } {
  const urls: string[] = [];
  const rest = text.replace(IMG_TAG, (_, url: string) => {
    urls.push(url);
    return "";
  });
  return { text: rest, urls };
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "text" in value)
    return String((value as Json).text ?? "");
  return value === null || value === undefined ? "" : String(value);
}

function imageFieldOf(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Json;
  const url = o.image ?? o.imageUrl ?? o.image_url;
  return typeof url === "string" && url ? url : null;
}

function toBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1 || v === "1") return true;
  if (v === "false" || v === 0 || v === "0" || v === null || v === undefined)
    return false;
  return null;
}

export type NormalizedQuestions = {
  questions: Question[];
  problems: LegacyProblem[];
  /** Every v1 image URL that was mapped into `media` (for the copy step). */
  mediaUrls: string[];
};

export function normalizeV1Questions(
  raw: unknown,
  mapMedia: MediaMapper = defaultV1MediaPath,
): NormalizedQuestions {
  const problems: LegacyProblem[] = [];
  const mediaUrls = new Set<string>();
  const out: Question[] = [];
  const usedIds = new Set<string>();

  if (!Array.isArray(raw)) {
    return {
      questions: [],
      problems: [{ severity: "error", message: "`questions` is not an array" }],
      mediaUrls: [],
    };
  }

  const toMedia = (url: string, index: number): Media | undefined => {
    const path = mapMedia(url);
    if (!path) {
      problems.push({
        index,
        severity: "warning",
        message: `image not migrated (unsupported URL): ${url.slice(0, 80)}`,
      });
      return undefined;
    }
    mediaUrls.add(url);
    return { path };
  };

  /** Clean one piece of text and take its first image. */
  const element = (value: unknown, index: number, extraUrl?: string | null) => {
    const { text: cleaned, hadHtml } = cleanLegacyText(textOf(value));
    if (hadHtml)
      problems.push({ index, severity: "warning", message: "HTML removed" });
    const { text, urls } = extractImages(cleaned);
    const all = [...(extraUrl ? [extraUrl] : []), ...urls];
    if (all.length > 1)
      problems.push({
        index,
        severity: "warning",
        message: `${all.length - 1} extra image(s) dropped`,
      });
    const image = all[0] ? toMedia(all[0], index) : undefined;
    return { text: cleanLegacyText(text).text, image };
  };

  for (const [index, item] of raw.entries()) {
    const fail = (message: string) =>
      problems.push({ index, severity: "error", message });
    if (!item || typeof item !== "object") {
      fail("not an object");
      continue;
    }
    const v1 = item as Json;
    const type = TYPE_MAP[String(v1.type ?? "abcd")];
    if (!type) {
      fail(`unsupported type "${String(v1.type)}", skipped`);
      continue;
    }

    // Points: a `[x pts]` marker in the stem wins over the stored field.
    let points: number | undefined;
    const stemRaw = textOf(v1.question).replace(
      POINTS_MARKER,
      (_, n: string) => {
        points ??= Number(n.replace(",", "."));
        return "";
      },
    );
    const stored = Number(v1.points);
    if (points === undefined && Number.isFinite(stored) && stored !== 1)
      points = stored;
    if (points !== undefined && (points < 0 || points > 100)) {
      problems.push({
        index,
        severity: "warning",
        message: `points ${points} out of range, using 1`,
      });
      points = undefined;
    }

    const stem = element(stemRaw, index, imageFieldOf(v1));
    const base = {
      id: "",
      stem: stem.text,
      ...(stem.image && { image: stem.image }),
      ...(points !== undefined && { points }),
      ...(typeof v1.explanation === "string" &&
        v1.explanation.trim() && {
          explanation: cleanLegacyText(v1.explanation).text,
        }),
    };

    const options = Array.isArray(v1.options) ? v1.options : [];
    let q: Question;
    if (type === "mcq") {
      const opts = options.map((o) => {
        const e = element(o, index, imageFieldOf(o));
        return { text: e.text, ...(e.image && { image: e.image }) };
      });
      const correct = v1.correct;
      const answer =
        typeof correct === "number"
          ? correct
          : String(correct ?? "")
              .trim()
              .toUpperCase()
              .charCodeAt(0) - 65;
      // v1 pads mcq options to 4 with empty strings; drop empty trailing ones.
      while (
        opts.length > 2 &&
        !opts.at(-1)?.text &&
        !opts.at(-1)?.image &&
        opts.length - 1 !== answer
      )
        opts.pop();
      if (!(answer >= 0 && answer < opts.length)) {
        fail(`mcq correct answer "${String(correct)}" not found`);
        continue;
      }
      q = { ...base, type: "mcq", options: opts, answer };
    } else if (type === "tf") {
      if (!Array.isArray(v1.correct)) {
        fail("true/false `correct` is not an array");
        continue;
      }
      const correct = v1.correct.map(toBool);
      if (correct.some((c) => c === null)) {
        fail("true/false `correct` has non-boolean values");
        continue;
      }
      if (correct.length !== options.length)
        problems.push({
          index,
          severity: "warning",
          message: `${options.length} statements but ${correct.length} answers; missing answers count as false`,
        });
      q = {
        ...base,
        type: "tf",
        statements: options.map((o, i) => ({
          text: element(o, index).text,
          answer: correct[i] === true,
        })),
      };
    } else {
      q = {
        ...base,
        type: "short",
        answer: canonicalShortAnswer(textOf(v1.correct)),
      };
    }

    // Keep the v1 id when it's valid and unique (10 §4); else a stable fallback.
    const v1Id = typeof v1.id === "string" ? v1.id : `q_${String(v1.id ?? "")}`;
    let id =
      QuestionIdSchema.safeParse(v1Id).success && !usedIds.has(v1Id)
        ? v1Id
        : `q_x${index + 1}`;
    while (usedIds.has(id)) id = `${id}x`;
    q.id = id;

    const parsed = QuestionSchema.safeParse(q);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      fail(`invalid after normalization: ${detail}`);
      continue;
    }
    usedIds.add(id);
    out.push(parsed.data);
  }

  return { questions: out, problems, mediaUrls: [...mediaUrls] };
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * v1 lesson columns → `LessonConfig`. v1 bakes distributed points into each
 * question at save time, so migrated lessons use `per-question` points and
 * grade exactly like v1. v1 always shows its exam guard.
 */
export function normalizeV1Config(row: Json): {
  config: LessonConfig;
  problems: LegacyProblem[];
} {
  const problems: LegacyProblem[] = [];
  const seconds =
    num(row.time_limit_hours) * 3600 +
    num(row.time_limit_minutes) * 60 +
    num(row.time_limit_seconds);
  let timeLimitSec: number | null =
    row.time_limit_enabled === true && seconds > 0 ? Math.round(seconds) : null;
  if (timeLimitSec !== null && (timeLimitSec < 60 || timeLimitSec > 6 * 3600)) {
    problems.push({
      severity: "warning",
      message: `time limit ${timeLimitSec}s clamped to 60 s–6 h`,
    });
    timeLimitSec = Math.min(Math.max(timeLimitSec, 60), 6 * 3600);
  }

  const size = Math.trunc(num(row.question_pool_size));
  const dist =
    row.question_type_distribution &&
    typeof row.question_type_distribution === "object"
      ? (row.question_type_distribution as Json)
      : {};
  const byType = {
    ...(num(dist.abcd) > 0 && { mcq: Math.trunc(num(dist.abcd)) }),
    ...(num(dist.truefalse) > 0 && { tf: Math.trunc(num(dist.truefalse)) }),
    ...(num(dist.number) > 0 && { short: Math.trunc(num(dist.number)) }),
  };
  const hasByType = Object.keys(byType).length > 0;
  const poolEnabled = row.enable_question_pool === true && size > 0;

  const config: LessonConfig = {
    ...DEFAULT_LESSON_CONFIG,
    timeLimitSec,
    shuffleQuestions: row.shuffle_questions === true,
    shuffleOptions: row.shuffle_answers === true,
    pool: poolEnabled
      ? {
          enabled: true,
          ...(hasByType ? { byType } : { size: Math.min(size, 200) }),
        }
      : { enabled: false },
    examGuard: true,
  };
  const parsed = LessonConfigSchema.safeParse(config);
  if (!parsed.success) {
    problems.push({
      severity: "warning",
      message: `config invalid (${parsed.error.issues[0]?.message}); using defaults`,
    });
    return { config: { ...DEFAULT_LESSON_CONFIG, examGuard: true }, problems };
  }
  return { config: parsed.data, problems };
}

/** 10/11/12 from v1's free-form grade ("12", "Lớp 12", 12). */
export function normalizeV1Grade(value: unknown): number | null {
  const m = /(1[0-2])/.exec(String(value ?? ""));
  return m ? Number(m[1]) : null;
}

/** v1 `tags` may be a text[], a JSON array or a comma list. */
export function normalizeV1Tags(value: unknown): string[] {
  let list: unknown[] = [];
  if (Array.isArray(value)) list = value;
  else if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      list = Array.isArray(parsed) ? parsed : value.split(",");
    } catch {
      list = value.split(",");
    }
  }
  const tags = list
    .map((t) =>
      String(t ?? "")
        .normalize("NFC")
        .trim(),
    )
    .filter((t) => t.length > 0 && t.length <= 50);
  return [...new Set(tags)].slice(0, 20);
}
