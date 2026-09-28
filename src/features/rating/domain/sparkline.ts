/**
 * Mini rating chart geometry (S4-06). Pure SVG maths, so the dashboard ships
 * no chart JavaScript (the full chart on /profile is lazy-loaded, S4-07).
 */

/** Rating after each of the latest changes, oldest first, with the start. */
export function ratingSeries(
  recent: readonly { before: number; after: number }[],
): number[] {
  const first = recent[0];
  return first ? [first.before, ...recent.map((p) => p.after)] : [];
}

/**
 * `x,y` points for an SVG polyline in a `width × height` box, with `pad`
 * kept free on every side. A flat series sits in the middle.
 */
export function sparklinePoints(
  values: readonly number[],
  width: number,
  height: number,
  pad = 2,
): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const innerW = width - 2 * pad;
  const innerH = height - 2 * pad;
  const step = values.length > 1 ? innerW / (values.length - 1) : 0;
  const round = (n: number) => Math.round(n * 10) / 10;
  return values
    .map((v, i) => {
      const x = values.length > 1 ? pad + i * step : width / 2;
      const y = span === 0 ? height / 2 : pad + (1 - (v - min) / span) * innerH;
      return `${round(x)},${round(y)}`;
    })
    .join(" ");
}
