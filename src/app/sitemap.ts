import type { MetadataRoute } from "next";
import { PUBLIC_PATHS } from "@/lib/public-paths";
import { siteUrl } from "@/lib/site";

/** The public, static pages (S8-05). Share pages are reached from links only. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PUBLIC_PATHS.map((path) => ({
    url: new URL(path, base).href,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
