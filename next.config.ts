import type { NextConfig } from "next";
import { originOf, securityHeaders } from "./src/lib/security-headers";

// Lesson bookmarks ship in S2-07; the remaining legacy redirects arrive in S8-05.
const nextConfig: NextConfig = {
  // Enables `"use cache"`, `cacheTag` and `cacheLife` (ADR-005).
  cacheComponents: true,
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/lesson/:legacyId",
        destination: "/lessons/by-legacy/:legacyId",
        permanent: true,
      },
    ];
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
    ];
  },
};

export default nextConfig;
