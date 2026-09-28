/**
 * Security headers + CSP (06 §4). Pure, so it's unit-tested and usable from
 * next.config.ts.
 *
 * Why no nonce: a nonce CSP forces every page to render per request, which
 * rules out the static landing/theory pages and the prerendered shells that
 * keep us inside the free quotas (02 §3, 08). So scripts are limited to 'self'
 * plus 'unsafe-inline' (needed by Next's inline bootstrap and our theme
 * script). XSS defence rests on React escaping and on having no
 * dangerouslySetInnerHTML except KaTeX output and the constant theme script.
 */
export type HeaderOptions = {
  isDev: boolean;
  /** Supabase Storage/media origin, e.g. https://xyz.supabase.co */
  mediaOrigin?: string | null;
};

export function buildCsp({ isDev, mediaOrigin }: HeaderOptions): string {
  const media = mediaOrigin ? ` ${mediaOrigin}` : "";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${media}`,
    "font-src 'self'",
    `connect-src 'self'${media}`,
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    // http://localhost in dev and E2E must not be upgraded.
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

export function securityHeaders(
  options: HeaderOptions,
): Array<{ key: string; value: string }> {
  return [
    { key: "Content-Security-Policy", value: buildCsp(options) },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}

/** Origin of a URL, or null when unset/invalid. */
export function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
