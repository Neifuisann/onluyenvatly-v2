import { catalog } from "@/content/ly-thuyet/catalog";
import { allTopics } from "@/features/materials/domain/materials";

/**
 * Static public pages listed in the sitemap (S8-05). Add each public page as
 * it ships. Share pages (`/share/lessons/[id]`) are reached from links only.
 */
export const PUBLIC_PATHS: readonly string[] = [
  "/",
  "/ly-thuyet",
  ...allTopics(catalog).map((r) => r.href),
];
