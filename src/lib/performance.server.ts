import "server-only";
import { env } from "./env.server";

type Operation =
  | "attempt.start"
  | "attempt.result.read"
  | "lesson.metadata.miss";

/** Opt-in preview timings. Never accepts log data, errors or identifiers. */
export async function measureOperation<T>(
  operation: Operation,
  run: () => Promise<T>,
): Promise<T> {
  if (env.VERCEL_ENV !== "preview" || env.PERFORMANCE_DIAGNOSTICS !== "1")
    return run();
  const started = performance.now();
  let succeeded = false;
  try {
    const result = await run();
    succeeded = true;
    return result;
  } finally {
    console.info(
      JSON.stringify({
        evt: "s9_operation",
        operation,
        durationMs: Math.round(performance.now() - started),
        succeeded,
      }),
    );
  }
}
