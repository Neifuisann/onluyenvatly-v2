import type { NextConfig } from "next";

// Security headers + CSP arrive in S1-08, legacy redirects in S8-05.
const nextConfig: NextConfig = {
  // Enables `"use cache"`, `cacheTag` and `cacheLife` (ADR-005).
  cacheComponents: true,
  poweredByHeader: false,
};

export default nextConfig;
