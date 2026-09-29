import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * 08 §5: crawlers may read the landing, theory, gallery, policy and share
 * pages (plus what they need to render them) and nothing else. `/admin` and
 * `/attempts` also send `X-Robots-Tag: noindex` (next.config.ts).
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/$",
        "/ly-thuyet",
        "/gallery",
        "/share/lessons/",
        "/privacy",
        "/terms",
        "/opengraph-image",
        "/icons/",
        "/_next/static/",
      ],
      disallow: "/",
    },
    sitemap: new URL("/sitemap.xml", base).href,
  };
}
