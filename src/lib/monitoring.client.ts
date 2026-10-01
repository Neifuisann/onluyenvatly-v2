import * as Sentry from "@sentry/nextjs";
import { telemetryPrivacy } from "@/features/operations/domain/telemetry";
import { clientEnv } from "./env.client";

export function initializeMonitoring() {
  Sentry.init({
    dsn: clientEnv.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.05,
    ...telemetryPrivacy,
  });
  return Sentry;
}
