import createMDX from "@next/mdx";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import { catalog } from "./src/content/ly-thuyet/catalog";
import { materialRedirects } from "./src/features/materials/domain/materials";
import { LEGACY_REDIRECTS } from "./src/lib/legacy-redirects";
import { originOf, securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // Enables `"use cache"`, `cacheTag` and `cacheLife` (ADR-005).
  cacheComponents: true,
  poweredByHeader: false,
  // Link-preview bots get metadata in <head> instead of streamed (S8-03).
  // Next's default list plus Zalo, which most of our students share on.
  htmlLimitedBots:
    /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|Zalo/i,
  async redirects() {
    // v1 bookmarks (05 §1, S8-05): permanent, so browsers remember them.
    return [...LEGACY_REDIRECTS, ...materialRedirects(catalog)].map((r) => ({
      ...r,
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          isDev: process.env.NODE_ENV !== "production",
          mediaOrigin: originOf(process.env.NEXT_PUBLIC_MEDIA_BASE_URL),
          telemetryOrigin: originOf(process.env.NEXT_PUBLIC_SENTRY_DSN),
        }),
      },
      // Private areas stay out of search results even if a link leaks (08 §5).
      ...[
        "/admin/:path*",
        "/attempts/:path*",
        "/play/:path*",
        "/host/:path*",
      ].map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
    ];
  },
};

/**
 * Theory pages (S8-02) are MDX under src/content. `$…$` formulas become KaTeX
 * HTML at build time, like MathText's options (no KaTeX JS in the browser).
 * Plugins are named by string so Turbopack can load them.
 */
const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-math"],
    rehypePlugins: [
      [
        "rehype-katex",
        { strict: "ignore", trust: false, output: "htmlAndMathml" },
      ],
    ],
  },
});

/**
 * Sentry (12 §4). With `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT`
 * set on the build (Vercel, never in a file), source maps are uploaded and
 * then deleted from the output, so production stack traces are readable
 * without serving maps. Without them nothing is uploaded or generated.
 */
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN);
export default withSentryConfig(withMDX(nextConfig), {
  silent: !process.env.CI,
  sourcemaps: {
    disable: !uploadSourceMaps,
    deleteSourcemapsAfterUpload: true,
  },
  widenClientFileUpload: uploadSourceMaps,
  telemetry: false,
});
