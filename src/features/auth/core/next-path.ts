/**
 * `?next=` handling (06 §1): only same-origin relative paths that start with
 * `/` (not `//` or `/\`) are allowed, so login can't be used as an open redirect.
 */
const BASE = "http://n.invalid";
const AUTH_PAGES = ["/login", "/register"];

export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512)
    return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  // Backslashes and control characters are normalized by browsers into `//`.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: that's the point
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  if (
    AUTH_PAGES.some(
      (p) => url.pathname === p || url.pathname.startsWith(`${p}/`),
    )
  )
    return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
