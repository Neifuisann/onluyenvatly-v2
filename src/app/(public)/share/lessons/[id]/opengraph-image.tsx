import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { catalogCopy, shareCopy } from "@/features/lessons/messages";
import { shellCopy } from "@/lib/messages";
import { sharePreviewFor } from "./preview";

/**
 * The share link's preview card (S8-03), 1200×630 PNG for Zalo/Facebook.
 * Drawn from the cached share preview (no extra query); colors are the
 * Lagoon ink/teal/sun tokens as hex, since `ImageResponse` has no CSS vars.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = shellCopy.appName;

const INK = "#1d2748";
const TEAL = "#5fd3d0";
const SUN = "#f5c84b";
const MUTED = "#b9c2d6";

const logo = readFile(join(process.cwd(), "src/app/apple-icon.png")).then(
  (b) => `data:image/png;base64,${b.toString("base64")}`,
);

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const lesson = await sharePreviewFor((await params).id);
  const title = lesson?.title ?? shellCopy.appName;
  const meta = lesson
    ? [
        lesson.grade ? catalogCopy.grade(lesson.grade) : null,
        lesson.chapter,
        shareCopy.imageQuestions(lesson.questionCount),
      ]
        .filter(Boolean)
        .join(" · ")
    : shellCopy.appDescription;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: INK,
        color: "white",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {/* biome-ignore lint/performance/noImgElement: ImageResponse markup */}
        <img src={await logo} width={72} height={72} alt="" />
        <span style={{ fontSize: 34, fontWeight: 700 }}>
          {shellCopy.appName}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <span
          style={{
            fontSize: 28,
            color: SUN,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          {shareCopy.eyebrow}
        </span>
        <span
          style={{
            fontSize: title.length > 60 ? 56 : 72,
            fontWeight: 700,
            lineHeight: 1.1,
            display: "flex",
          }}
        >
          {title}
        </span>
        <span style={{ fontSize: 32, color: MUTED }}>{meta}</span>
      </div>
      <div style={{ display: "flex", height: 12, borderRadius: 6 }}>
        <div style={{ flex: 3, background: TEAL, borderRadius: 6 }} />
        <div style={{ width: 16 }} />
        <div style={{ flex: 1, background: SUN, borderRadius: 6 }} />
      </div>
    </div>,
    size,
  );
}
