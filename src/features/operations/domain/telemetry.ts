import type * as Sentry from "@sentry/nextjs";
import type { Event } from "@sentry/nextjs";

type StreamedSpan = Parameters<
  NonNullable<Parameters<typeof Sentry.init>[0]["beforeSendSpan"]>
>[0];

/** Allowlist rather than redaction: unexpected SDK fields must not carry PII. */
export function sanitizeTelemetry<T extends Event>(event: T): T {
  const allowed = [
    "event_id",
    "timestamp",
    "start_timestamp",
    "type",
    "level",
  ] as const;
  const clean = { ...event };
  const record = clean as unknown as Partial<Record<string, unknown>>;
  const keys = new Set<string>(allowed);
  for (const key of Object.keys(clean)) if (!keys.has(key)) delete record[key];
  clean.platform = "javascript";
  if (event.release && /^[a-f0-9]{7,40}$/.test(event.release))
    clean.release = event.release;
  if (
    event.environment &&
    ["production", "preview", "development", "test"].includes(event.environment)
  )
    clean.environment = event.environment;
  if (event.transaction) clean.transaction = "application";
  if (event.exception?.values)
    clean.exception = {
      values: event.exception.values.map((exception) => ({
        type: [
          "Error",
          "TypeError",
          "RangeError",
          "SyntaxError",
          "PostgresError",
        ].includes(exception.type ?? "")
          ? (exception.type ?? "Error")
          : "Error",
        value: "Unexpected application error",
        ...(exception.stacktrace
          ? {
              stacktrace: {
                frames: (exception.stacktrace.frames ?? []).map((frame) => {
                  const base = frame.filename
                    ?.split(/[\\/]/)
                    .at(-1)
                    ?.split(/[?#]/)[0];
                  return {
                    ...(base && /^[\w.-]+\.[cm]?[jt]sx?$/.test(base)
                      ? { filename: base }
                      : {}),
                    ...(frame.lineno === undefined
                      ? {}
                      : { lineno: frame.lineno }),
                    ...(frame.colno === undefined
                      ? {}
                      : { colno: frame.colno }),
                  };
                }),
              },
            }
          : {}),
      })),
    };
  const trace = event.contexts?.trace;
  if (
    typeof trace?.trace_id === "string" &&
    /^[a-f0-9]{32}$/.test(trace.trace_id) &&
    typeof trace.span_id === "string" &&
    /^[a-f0-9]{16}$/.test(trace.span_id)
  )
    clean.contexts = {
      trace: { trace_id: trace.trace_id, span_id: trace.span_id },
    };
  // Root trace duration remains available; request/SQL/DOM span attributes do not.
  if (event.spans) clean.spans = [];
  return clean;
}

/** Sentry 11 streams spans; beforeSendTransaction does not protect this path. */
export function sanitizeSpan(span: StreamedSpan): StreamedSpan {
  return {
    trace_id: span.trace_id,
    span_id: span.span_id,
    ...(span.parent_span_id ? { parent_span_id: span.parent_span_id } : {}),
    name: "application",
    start_timestamp: span.start_timestamp,
    ...(span.end_timestamp === undefined
      ? {}
      : { end_timestamp: span.end_timestamp }),
    status: span.status,
    is_segment: span.is_segment,
    attributes: {},
  };
}

export const telemetryPrivacy = {
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    queues: false,
    stackFrameVariables: false,
    frameContextLines: 0,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
  },
  beforeSend: sanitizeTelemetry,
  beforeSendSpan: sanitizeSpan,
  beforeSendLog: () => null,
  beforeSendMetric: () => null,
  beforeBreadcrumb: () => null,
};
