import type { Event } from "@sentry/nextjs";
import { expect, it } from "vitest";
import { sanitizeSpan, sanitizeTelemetry, telemetryPrivacy } from "./telemetry";

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
