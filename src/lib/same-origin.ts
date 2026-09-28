/**
 * CSRF check for mutating route handlers (14 §2, 06 §4). Server Actions check
 * `Origin` themselves; plain JSON handlers call this. Browsers send `Origin`
 * on POST (fetch, keepalive and sendBeacon alike); `Sec-Fetch-Site` covers
 * the rare request without it. Anything else (no browser metadata) is refused,
 * so scripted clients such as k6 must send an `Origin` header.
 */
export function isSameOrigin(headers: Headers, requestUrl: string): boolean {
  const origin = headers.get("origin");
  if (origin) {
    try {
      return origin === new URL(requestUrl).origin;
    } catch {
      return false;
    }
  }
  return headers.get("sec-fetch-site") === "same-origin";
}
