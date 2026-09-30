import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { cardClass } from "@/components/ui/card";
import { gallery } from "@/content/gallery";
import { galleryCopy as t } from "@/lib/messages";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: t.title,
  description: t.lead,
  alternates: { canonical: "/gallery" },
};

/**
 * `/gallery` (S8-03): v1's handouts as WebP. Static, no client JavaScript:
 * each 480 px thumbnail opens the 1600 px image in a new tab, where phones
 * can zoom it. Plain `<img>` with intrinsic sizes (ADR-006).
 */
export default function GalleryPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader title={t.title} lead={t.lead} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {gallery.map((item, i) => (
          <li key={item.src}>
            <a
              href={item.src}
              target="_blank"
              rel="noopener"
              className={cn(
                cardClass,
                "group block overflow-hidden transition-shadow hover:shadow-raised",
              )}
            >
              {/* biome-ignore lint/performance/noImgElement: ADR-006 */}
              <img
                src={item.thumb}
                width={item.thumbWidth}
                height={item.thumbHeight}
                alt={t.item(i + 1)}
                loading={i < 4 ? "eager" : "lazy"}
                decoding="async"
                className="h-auto w-full bg-muted"
              />
              <span className="block px-3 py-2 font-medium text-sm">
                {t.item(i + 1)}
                <span className="sr-only"> {t.opensNewTab}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
