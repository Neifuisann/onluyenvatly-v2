/** Daily chores use strict cutoffs; active windows and recent private data stay. */
export function retentionCutoffs(now: Date) {
  const day = 86_400_000;
  return {
    expiry: new Date(now.getTime() - 3_600_000),
    rateLimits: new Date(now.getTime() - 2 * day),
    privateData: new Date(now.getTime() - 180 * day),
    /** A lobby nobody started by then is abandoned (B-05). */
    staleLobbies: new Date(now.getTime() - day),
    /** Game rooms and their players are kept a month (B-05). */
    gameRooms: new Date(now.getTime() - 30 * day),
  };
}
