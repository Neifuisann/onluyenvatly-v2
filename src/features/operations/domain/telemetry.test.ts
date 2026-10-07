import type { Event } from "@sentry/nextjs";
import { expect, it } from "vitest";
import {
  safeSpanName,
  sanitizeSpan,
  sanitizeTelemetry,
  telemetryPrivacy,
} from "./telemetry";

it("removes request bodies, URLs, users, messages, breadcrumbs, arbitrary fields and stack locals", () => {
  const event: Event = {
    event_id: "safe-event",
    timestamp: 1,
    level: "error",
    release: "a145c57",
    environment: "preview",
    user: { email: "private@example.test", ip_address: "203.0.113.1" },
    message: "password-private",
    request: { url: "https://example.test/?password=private", data: "private" },
    extra: { token: "private" },
    tags: { student: "private" },
    breadcrumbs: [{ message: "private", data: { authorization: "private" } }],
    exception: {
      values: [
        {
          type: "TypeError",
          value: "private",
          stacktrace: {
            frames: [
              {
                filename: "C:\\Users\\private\\src\\service.ts",
                lineno: 7,
                vars: { password: "private" },
                context_line: "private",
              },
            ],
          },
        },
      ],
    },
  };
  const clean = sanitizeTelemetry(event);
  expect(JSON.stringify(clean)).not.toContain("private");
  expect(clean.exception?.values?.[0]?.stacktrace?.frames).toEqual([
    { filename: "service.ts", lineno: 7 },
  ]);
  expect(clean.release).toBe("a145c57");
  expect(event.user?.email).toBe("private@example.test");
});
it("keeps sampled trace timing and validated trace IDs while stripping transaction names and spans", () => {
  const event: Event = {
    type: "transaction",
    transaction: "/profile/private",
    start_timestamp: 1,
    timestamp: 2,
    contexts: {
      trace: {
        trace_id: "a".repeat(32),
        span_id: "b".repeat(16),
        data: { password: "private" },
      },
    },
    spans: [],
    release: "private-release",
    environment: "private-environment",
  };
  expect(sanitizeTelemetry(event)).toEqual({
    type: "transaction",
    start_timestamp: 1,
    timestamp: 2,
    platform: "javascript",
    transaction: "application",
    spans: [],
    contexts: { trace: { trace_id: "a".repeat(32), span_id: "b".repeat(16) } },
  });
  expect(
    sanitizeTelemetry({
      contexts: { trace: { trace_id: "private", span_id: "private" } },
    }).contexts,
  ).toBeUndefined();
});

it("allowlists streamed spans and disables logs, metrics and breadcrumbs", () => {
  const span = {
    trace_id: "a".repeat(32),
    span_id: "b".repeat(16),
    parent_span_id: "c".repeat(16),
    name: "private",
    start_timestamp: 1,
    end_timestamp: 2,
    status: "ok" as const,
    is_segment: true,
    attributes: { "db.query.text": "private", "http.request.body": "private" },
    links: [],
  };
  expect(JSON.stringify(sanitizeSpan(span))).not.toContain("private");
  expect(sanitizeSpan(span).end_timestamp).toBe(2);
  const { end_timestamp: _end, ...unfinished } = span;
  expect(sanitizeSpan(unfinished).attributes).toEqual({});
  expect(telemetryPrivacy.beforeSendLog()).toBeNull();
  expect(telemetryPrivacy.beforeSendMetric()).toBeNull();
  expect(telemetryPrivacy.beforeBreadcrumb()).toBeNull();
});

it("keeps build chunk paths and source map debug IDs so stack traces resolve", () => {
  const debugId = "0b5c2a7e-1f3d-4c8a-9e2b-6d4f1a3c5e7b";
  const clean = sanitizeTelemetry({
    exception: {
      values: [
        {
          type: "Error",
          stacktrace: {
            frames: [
              {
                filename:
                  "https://onluyenvatly.vercel.app/_next/static/chunks/13c8331ph4w70.js",
                function: "submitAttempt",
                lineno: 1,
                colno: 4021,
                in_app: true,
              },
              { abs_path: "app:///_next/server/chunks/ssr/0q1w.js", lineno: 3 },
              { filename: "/home/private/app/.next/server/x.js", lineno: 2 },
              { filename: "https://example.test/_next/static/a.js?private" },
              { filename: "x.js", function: "private value" },
            ],
          },
        },
      ],
    },
    debug_meta: {
      images: [
        {
          type: "sourcemap",
          code_file:
            "https://onluyenvatly.vercel.app/_next/static/chunks/13c8331ph4w70.js",
          debug_id: debugId,
        },
        { type: "sourcemap", code_file: "C:privatea.js", debug_id: debugId },
      ],
    },
  });
  expect(JSON.stringify(clean)).not.toContain("private");
  expect(clean.exception?.values?.[0]?.stacktrace?.frames).toEqual([
    {
      filename:
        "https://onluyenvatly.vercel.app/_next/static/chunks/13c8331ph4w70.js",
      abs_path:
        "https://onluyenvatly.vercel.app/_next/static/chunks/13c8331ph4w70.js",
      function: "submitAttempt",
      in_app: true,
      lineno: 1,
      colno: 4021,
    },
    {
      filename: "app:///_next/server/chunks/ssr/0q1w.js",
      abs_path: "app:///_next/server/chunks/ssr/0q1w.js",
      lineno: 3,
    },
    { filename: "x.js", lineno: 2 },
    { filename: "a.js" },
    { filename: "x.js" },
  ]);
  expect(clean.debug_meta?.images).toEqual([
    {
      type: "sourcemap",
      code_file:
        "https://onluyenvatly.vercel.app/_next/static/chunks/13c8331ph4w70.js",
      debug_id: debugId,
    },
  ]);
});

it("names spans by route template and keeps only Web Vitals, status and op", () => {
  expect(safeSpanName("GET /lessons/[id]")).toBe("GET /lessons/[id]");
  expect(safeSpanName("/attempts/[id]/result")).toBe("/attempts/[id]/result");
  expect(safeSpanName("/lessons/511")).toBe("application");
  expect(
    safeSpanName("/attempts/2fbfe2df-7156-41b5-848f-d40c2a0398bf/result"),
  ).toBe("application");
  expect(safeSpanName("select * from users")).toBe("application");
  expect(safeSpanName("/review?chapter=private")).toBe("application");
  const span = sanitizeSpan({
    trace_id: "a".repeat(32),
    span_id: "b".repeat(16),
    name: "/dashboard",
    start_timestamp: 1,
    end_timestamp: 2,
    status: "ok",
    is_segment: true,
    attributes: {
      "browser.web_vital.lcp.value": 1234.5,
      "browser.web_vital.lcp.element": "p.private",
      "http.response.status_code": { value: 200, type: "integer" },
      "sentry.op": "pageload",
      "sentry.origin": "Private Origin",
      "url.full": "https://example.test/private",
    },
  });
  expect(span.name).toBe("/dashboard");
  expect(span.attributes).toEqual({
    "browser.web_vital.lcp.value": 1234.5,
    "http.response.status_code": 200,
    "sentry.op": "pageload",
  });
});
