/** Keep only our dated backup objects: 30 daily and 12 monthly copies. */
export function backupsToPrune(keys: readonly string[]): string[] {
  const expired: string[] = [];
  for (const [kind, limit, date] of [
    ["daily", 30, "\\d{4}-\\d{2}-\\d{2}"],
    ["monthly", 12, "\\d{4}-\\d{2}"],
  ] as const) {
    const pattern = new RegExp(`^ovl-v2/${kind}/${date}\\.dump\\.age$`);
    const copies = [...new Set(keys.filter((key) => pattern.test(key)))].sort();
    expired.push(...copies.slice(0, Math.max(0, copies.length - limit)));
  }
  return expired;
}
