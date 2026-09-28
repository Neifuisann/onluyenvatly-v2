/**
 * Display formats (07 §6): dates as `28/09/2026 21:30`, always in Vietnam
 * time; scores with a comma decimal (`7,75`).
 */

const dateTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDateTime(date: Date): string {
  const parts = Object.fromEntries(
    dateTime.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

/** Up to 2 decimals, comma separator, no trailing zeros: 7,75 · 8 · 0,5. */
export function formatScore(value: number): string {
  return (Math.round(value * 100) / 100).toString().replace(".", ",");
}

/** `mm:ss`, or `h:mm:ss` from one hour. Negative input shows 00:00. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
