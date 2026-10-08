import * as Sentry from "@sentry/nextjs";
import { telemetryPrivacy } from "@/features/operations/domain/telemetry";
import { clientEnv } from "./env.client";

export function initializeMonitoring() {
  Sentry.init({
    dsn: clientEnv.NEXT_PUBLIC_SENTRY_DSN,
    // Vercel sets it on every build; anything else is a local build.
    environment: clientEnv.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    tracesSampleRate: 0.05,
    ...telemetryPrivacy,
  });
  return Sentry;
}
