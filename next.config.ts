import type { NextConfig } from "next";
import { originOf, securityHeaders } from "./src/lib/security-headers";

// Legacy redirects arrive in S8-05.
const nextConfig: NextConfig = {
  // Enables `"use cache"`, `cacheTag` and `cacheLife` (ADR-005).
  cacheComponents: true,
  poweredByHeader: false,
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
