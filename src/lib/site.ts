import "server-only";
import { env } from "./env.server";

/**
 * Absolute origin of the site for metadata, the sitemap, robots.txt and OG
 * images (S8-05): `SITE_URL`, else the Vercel production host, else local.
 */
export function siteUrl(): URL {
  if (env.SITE_URL) return new URL(env.SITE_URL);
  if (env.VERCEL_PROJECT_PRODUCTION_URL)
    return new URL(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
  return new URL("http://localhost:3000");
}
