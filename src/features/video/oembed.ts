import "server-only";
import { youtubeWatchUrl } from "@/features/lessons/domain/video";

export type VideoLookup =
  | { kind: "ok"; title: string | null }
  /** Private, removed, or its owner turned embedding off. */
  | { kind: "unavailable" };

/**
 * Asks YouTube's public oEmbed endpoint about a video, for the new lesson's
 * title and to refuse a video that can't be embedded. No key, no quota of
 * ours. A network problem is not the teacher's fault: the lesson is created
 * with the default title and the player reports the video if it fails.
 */
export async function lookupVideo(youtubeId: string): Promise<VideoLookup> {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youtubeWatchUrl(youtubeId))}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403 || res.status === 404)
      return { kind: "unavailable" };
    if (!res.ok) return { kind: "ok", title: null };
    const body = (await res.json()) as { title?: unknown };
    const title =
      typeof body.title === "string"
        ? body.title.normalize("NFC").replace(/\s+/g, " ").trim().slice(0, 200)
        : "";
    return { kind: "ok", title: title || null };
  } catch {
    return { kind: "ok", title: null };
  }
}
