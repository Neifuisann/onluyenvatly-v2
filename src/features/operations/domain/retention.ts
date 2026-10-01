/** Daily chores use strict cutoffs; active windows and recent private data stay. */
export function retentionCutoffs(now: Date) {
  const day = 86_400_000;
  return {
    expiry: new Date(now.getTime() - 3_600_000),
    rateLimits: new Date(now.getTime() - 2 * day),
    privateData: new Date(now.getTime() - 180 * day),
  };
}
