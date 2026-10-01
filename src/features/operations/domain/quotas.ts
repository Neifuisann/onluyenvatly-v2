export type QuotaMetric = { name: string; used: number; limit: number };

/** The project budget calls for intervention at 60%, before a hard limit. */
export function quotaWarnings(metrics: readonly QuotaMetric[]) {
  return metrics.filter((metric) => {
    if (
      !Number.isFinite(metric.used) ||
      metric.used < 0 ||
      !Number.isFinite(metric.limit) ||
      metric.limit <= 0
    )
      throw new Error("Invalid quota metric");
    return metric.used >= metric.limit * 0.6;
  });
}
