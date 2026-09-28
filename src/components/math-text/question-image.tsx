import type { Media } from "@/features/lessons/schema";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

/**
 * A question's or option's own image (`image` field). Plain `<img>` with its
 * stored size so the page doesn't shift; no next/image quota (ADR-006).
 */
export function QuestionImage({
  media,
  className,
}: {
  media: Media;
  className?: string;
}) {
  const src = mediaUrl(media.path);
  if (!src)
    return (
      <span className={cn("block text-muted-foreground text-sm", className)}>
        [{media.alt || media.path}]
      </span>
    );
  return (
    // biome-ignore lint/performance/noImgElement: see ADR-006
    <img
      src={src}
      alt={media.alt ?? ""}
      {...(media.w && media.h ? { width: media.w, height: media.h } : {})}
      loading="lazy"
      decoding="async"
      className={cn("my-2 block h-auto max-w-full rounded-md", className)}
    />
  );
}
