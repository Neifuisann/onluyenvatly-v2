/**
 * Video lessons ("Học qua video"): YouTube links, times along the video and
 * the order questions are asked in. Pure; imported by relative path from the
 * text format, so no path aliases.
 */
import { MAX_VIDEO_SECONDS } from "../schema.ts";

const ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);
/** `/embed/ID`, `/shorts/ID`, `/live/ID`, `/v/ID`. */
const PATH_ID = /^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/;

/**
 * The video id of a YouTube link a teacher pastes (`watch?v=`, `youtu.be/`,
 * embed, shorts, live), or of a bare 11-character id. Null otherwise.
 */
export function parseYoutubeId(input: string): string | null {
  const raw = input.trim();
  if (ID.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`,
    );
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0] ?? "";
    return ID.test(id) ? id : null;
  }
  if (!YOUTUBE_HOSTS.has(host)) return null;
  const v = url.searchParams.get("v");
  if (url.pathname === "/watch") return v && ID.test(v) ? v : null;
  return PATH_ID.exec(url.pathname)?.[1] ?? null;
}

/** The link stored lessons show: `https://www.youtube.com/watch?v=ID`. */
export const youtubeWatchUrl = (id: string) =>
  `https://www.youtube.com/watch?v=${id}`;

/** A thumbnail for the editor and cards. */
export const youtubeThumbnail = (id: string) =>
  `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/**
 * `83`, `1:23` or `1:02:03` → seconds; null when it isn't a time or is past
 * `MAX_VIDEO_SECONDS`. Minutes and seconds after the first part are 0–59.
 */
export function parseVideoTime(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d{1,5}(?::\d{1,2}){0,2}$/.test(s)) return null;
  const parts = s.split(":").map(Number);
  if (parts.slice(1).some((p) => p > 59)) return null;
  const seconds = parts.reduce((total, p) => total * 60 + p, 0);
  return seconds <= MAX_VIDEO_SECONDS ? seconds : null;
}

/** Seconds → `1:23`, or `1:02:03` from an hour. Fractions are dropped. */
export function formatVideoTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/**
 * The order a video lesson asks its questions in: by time, the teacher's
 * order within one time, and questions without a time last (at the end of
 * the video). A time at or past the video's length counts as the end.
 */
export function orderByVideoTime<Q extends { at?: number | undefined }>(
  questions: readonly Q[],
  durationSec: number | null = null,
): Q[] {
  const key = (q: Q) => videoTimeOf(q, durationSec) ?? Number.POSITIVE_INFINITY;
  return questions
    .map((q, i) => ({ q, i }))
    .sort((a, b) => key(a.q) - key(b.q) || a.i - b.i)
    .map(({ q }) => q);
}

/** When the question is asked: its second, or null for the end of the video. */
export function videoTimeOf(
  q: { at?: number | undefined },
  durationSec: number | null,
): number | null {
  if (q.at === undefined) return null;
  return durationSec !== null && q.at >= durationSec ? null : q.at;
}
