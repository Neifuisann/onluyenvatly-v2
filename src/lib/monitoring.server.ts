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
    tracesSampleRate: 0.05,
    ...telemetryPrivacy,
  });
}

export const captureRequestError = Sentry.captureRequestError;
