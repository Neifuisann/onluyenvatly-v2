import { describe, expect, it } from "vitest";
import { buildCsp, originOf, securityHeaders } from "./security-headers";

const directive = (csp: string, name: string) =>
  csp.split("; ").find((d) => d.startsWith(`${name} `));

describe("buildCsp", () => {
  it("locks production down", () => {
    const csp = buildCsp({ isDev: false });
    expect(directive(csp, "default-src")).toBe("default-src 'self'");
    expect(directive(csp, "script-src")).toBe(
      "script-src 'self' 'unsafe-inline'",
    );
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
    expect(directive(csp, "form-action")).toBe("form-action 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("allows eval and plain http only in dev", () => {
    const csp = buildCsp({ isDev: true });
    expect(directive(csp, "script-src")).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("adds the media origin to img-src and connect-src only", () => {
    const csp = buildCsp({
      isDev: false,
      mediaOrigin: "https://x.supabase.co",
    });
    expect(directive(csp, "img-src")).toContain("https://x.supabase.co");
    expect(directive(csp, "connect-src")).toContain("https://x.supabase.co");
    expect(directive(csp, "script-src")).not.toContain("supabase");
  });

  it("allows the configured telemetry host only for connections", () => {
    const csp = buildCsp({
      isDev: false,
      telemetryOrigin: "https://o1.ingest.sentry.io",
    });
    expect(directive(csp, "connect-src")).toContain(
      "https://o1.ingest.sentry.io",
    );
    for (const name of ["script-src", "img-src", "frame-src"]) {
      expect(directive(csp, name) ?? "").not.toContain("sentry.io");
    }
    expect(csp).not.toContain("*.sentry.io");
  });
});

describe("securityHeaders", () => {
  it("includes every header from 06 §4", () => {
    const keys = securityHeaders({ isDev: false }).map((h) => h.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Permissions-Policy",
        "X-Frame-Options",
      ]),
    );
  });
});

describe("originOf", () => {
  it("extracts an origin or returns null", () => {
    expect(
      originOf("https://x.supabase.co/storage/v1/object/public/media"),
    ).toBe("https://x.supabase.co");
    expect(originOf(undefined)).toBeNull();
    expect(originOf("not a url")).toBeNull();
  });
});
