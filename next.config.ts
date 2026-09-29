import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import { catalog } from "./src/content/ly-thuyet/catalog";
import { materialRedirects } from "./src/features/materials/domain/materials";
import { LEGACY_REDIRECTS } from "./src/lib/legacy-redirects";
import { originOf, securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // Enables `"use cache"`, `cacheTag` and `cacheLife` (ADR-005).
  cacheComponents: true,
  poweredByHeader: false,
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
        }),
      },
      // Private areas stay out of search results even if a link leaks (08 §5).
      ...["/admin/:path*", "/attempts/:path*"].map((source) => ({
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

export default withMDX(nextConfig);
