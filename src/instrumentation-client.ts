import type * as Sentry from "@sentry/nextjs";
import { initializeClientMonitoring } from "@/lib/monitoring-bootstrap";

const monitoring = initializeClientMonitoring();

export function onRouterTransitionStart(
  ...args: Parameters<typeof Sentry.captureRouterTransitionStart>
) {
  void monitoring
    ?.then((sdk) => sdk.captureRouterTransitionStart(...args))
    .catch(() => {});
}
