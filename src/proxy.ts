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

  // A download answers 401 JSON itself (its handler checks the session);
  // a redirect to the login page would be saved as the CSV.
  if (!token && pathname === "/admin/results/export")
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

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/lessons/:path*",
    "/attempts/:path*",
    "/review/:path*",
    "/leaderboard/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/admin/:path*",
  ],
};
