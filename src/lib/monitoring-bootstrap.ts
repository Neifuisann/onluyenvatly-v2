import { clientEnv } from "./env.client";

let pending: Promise<typeof import("@sentry/nextjs")> | undefined;
export function initializeClientMonitoring() {
  if (!clientEnv.NEXT_PUBLIC_SENTRY_DSN) return undefined;
  pending ??= import("./monitoring.client").then((module) =>
    module.initializeMonitoring(),
  );
  return pending;
}

export function reportClientError(error: Error) {
  void initializeClientMonitoring()
    ?.then((sdk) => sdk.captureException(error))
    .catch(() => {});
}
