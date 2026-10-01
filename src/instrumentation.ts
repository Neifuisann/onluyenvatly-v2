import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const monitoring = await import("./lib/monitoring.server");
    monitoring.initializeMonitoring();
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  ...args
) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const monitoring = await import("./lib/monitoring.server");
    monitoring.captureRequestError(...args);
  }
};
