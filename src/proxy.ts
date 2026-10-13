import { type NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/features/auth/core/cookie";

/**
 * Cheap cookie-presence check for signed-in areas (06 §1). NOT a security
 * boundary: layouts, actions and route handlers call the real guards.
 * No DB access here.
 */
export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const { pathname, search } = request.nextUrl;

  // Downloads answer 401 JSON themselves (their handlers check the session);
  // a redirect to the login page would be saved as the file.
  if (
    !token &&
    (pathname === "/admin/results/export" || pathname === "/settings/export")
  )
    return NextResponse.next();

  if (!token) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  // Keep the cookie's lifetime in step with the DB's sliding expiry. Only on
  // page GETs, so a logout action's cookie deletion is never overwritten.
  const response = NextResponse.next();
  if (request.method === "GET" && !request.headers.has("next-action")) {
    // NODE_ENV is inlined at build time; plain http on localhost in dev.
    response.cookies.set(
      SESSION_COOKIE,
      token,
      sessionCookieOptions(process.env.NODE_ENV === "production"),
    );
  }
  return response;
}

/**
 * Router prefetches skip the proxy: they fetch the prerendered shell up to
 * `loading.tsx` (no user data), which the CDN then serves without starting a
 * function. They were half of all invocations (2026-10-13 logs, 08 §4). The
 * matcher must be a literal, so the condition is repeated per area.
 */
export const config = {
  matcher: [
    {
      source: "/dashboard/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/lessons/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/classes/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/attempts/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/review/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/leaderboard/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/profile/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/settings/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/admin/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/play/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/host/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/join/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
