import "server-only";
import * as Sentry from "@sentry/nextjs";
import { telemetryPrivacy } from "@/features/operations/domain/telemetry";
import { env } from "./env.server";

export function initializeMonitoring() {
  if (!env.SENTRY_DSN) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.VERCEL_ENV ?? env.NODE_ENV,
    ...(env.VERCEL_GIT_COMMIT_SHA
      ? { release: env.VERCEL_GIT_COMMIT_SHA }
      : {}),
    // Errors only: tracing instruments every request even when the trace is
    // not sampled, and Active CPU is the scarcest quota (08 §3). Speed
    // Insights and the browser's sampled traces cover performance.
    ...telemetryPrivacy,
  });
}

export const captureRequestError = Sentry.captureRequestError;
