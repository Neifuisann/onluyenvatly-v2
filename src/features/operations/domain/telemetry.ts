import type * as Sentry from "@sentry/nextjs";
import type { Event } from "@sentry/nextjs";

type StreamedSpan = Parameters<
  NonNullable<Parameters<typeof Sentry.init>[0]["beforeSendSpan"]>
>[0];

/**
 * Build output paths: browser chunks (`https://host/_next/static/…`) and
 * server chunks, which the SDK rewrites to `app:///_next/…`. They hold no
 * user data and must stay whole for uploaded source maps to apply; any other
 * path (a local checkout, a query string) keeps only its basename.
 */
const BUILD_PATH =
  /^(?:https?:\/\/[\w.-]+(?::\d+)?\/_next\/static|app:\/\/\/_next)\/[\w\-./[\]()@%]+\.[cm]?js$/;
const isBuildPath = (path: unknown): path is string =>
  typeof path === "string" && path.length <= 300 && BUILD_PATH.test(path);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
                  const path = frame.abs_path ?? frame.filename;
                  return {
                    ...(isBuildPath(path)
                      ? { filename: path, abs_path: path }
                      : base && /^[\w.-]+\.[cm]?[jt]sx?$/.test(base)
                        ? { filename: base }
                        : {}),
                    ...(frame.function &&
                    /^[\w$.<>]{1,100}$/.test(frame.function)
                      ? { function: frame.function }
                      : {}),
                    ...(frame.in_app === undefined
                      ? {}
                      : { in_app: frame.in_app }),
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
  // Source map debug IDs of build chunks, so minified frames resolve.
  const images = event.debug_meta?.images?.flatMap((image) =>
    image.type === "sourcemap" &&
    isBuildPath(image.code_file) &&
    UUID.test(image.debug_id)
      ? [
          {
            type: "sourcemap" as const,
            code_file: image.code_file,
            debug_id: image.debug_id,
          },
        ]
      : [],
  );
  if (images?.length) clean.debug_meta = { images };
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

/**
 * Route templates ("GET /lessons/[id]", "/attempts/[id]/result") name spans
 * so traces show where time goes. Concrete URLs (a numeric or hex segment),
 * SQL and anything else become "application".
 */
const ROUTE_NAME =
  /^(?:(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) )?\/[\w\-./[\]()@]{0,200}$/;
const ID_SEGMENT = /\/(?:\d+|[0-9a-f-]{8,})(?=\/|$)/i;
export function safeSpanName(name: string): string {
  return ROUTE_NAME.test(name) && !ID_SEGMENT.test(name) ? name : "application";
}

/** Numeric Web Vitals and status codes, plus the SDK's own op/origin enums. */
function safeSpanAttributes(attributes: Record<string, unknown>) {
  const kept: Record<string, string | number> = {};
  for (const [key, raw] of Object.entries(attributes)) {
    const value =
      raw && typeof raw === "object" && "value" in raw
        ? (raw as { value: unknown }).value
        : raw;
    if (
      (/^browser\.web_vital\.[a-z]+\.value$/.test(key) ||
        key === "http.response.status_code") &&
      typeof value === "number" &&
      Number.isFinite(value)
    )
      kept[key] = value;
    else if (
      (key === "sentry.op" || key === "sentry.origin") &&
      typeof value === "string" &&
      /^[a-z0-9_.]{1,60}$/.test(value)
    )
      kept[key] = value;
  }
  return kept;
}

/** Sentry 11 streams spans; beforeSendTransaction does not protect this path. */
export function sanitizeSpan(span: StreamedSpan): StreamedSpan {
  return {
    trace_id: span.trace_id,
    span_id: span.span_id,
    ...(span.parent_span_id ? { parent_span_id: span.parent_span_id } : {}),
    name: safeSpanName(span.name),
    start_timestamp: span.start_timestamp,
    ...(span.end_timestamp === undefined
      ? {}
      : { end_timestamp: span.end_timestamp }),
    status: span.status,
    is_segment: span.is_segment,
    attributes: safeSpanAttributes(span.attributes),
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
