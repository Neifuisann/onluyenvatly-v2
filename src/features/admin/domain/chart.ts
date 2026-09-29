/**
 * Bar chart geometry for server-rendered SVG (S6-06): no chart library on
 * admin pages. Pure numbers in a `width` × `height` viewBox.
 */

export type BarRect = { x: number; y: number; width: number; height: number };

const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * One bar per value, left to right, `gap` apart, scaled so the largest
 * reaches the top. Non-zero values get at least `minHeight` so a single
 * attempt stays visible; zero is flat.
 */
export function barLayout(
  values: readonly number[],
  width: number,
  height: number,
  gap = 2,
  minHeight = 1,
): BarRect[] {
  const n = values.length;
  if (n === 0) return [];
  const max = Math.max(0, ...values);
  const barWidth = Math.max(0, (width - gap * (n - 1)) / n);
  return values.map((v, i) => {
    const h =
      max > 0 && v > 0
        ? Math.max(minHeight, (Math.max(0, v) / max) * height)
        : 0;
    return {
      x: r2(i * (barWidth + gap)),
      y: r2(height - h),
      width: r2(barWidth),
      height: r2(h),
    };
  });
}
