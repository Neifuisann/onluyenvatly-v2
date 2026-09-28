/**
 * WCAG 2.x contrast for the design tokens (07 §3.1). Pure: no I/O.
 * Supports `oklch(L C H)` and `#rrggbb`, which is all globals.css uses.
 */

type Rgb = [number, number, number]; // linear sRGB, 0..1

const clamp = (x: number) => Math.min(1, Math.max(0, x));

export function oklchToLinearSrgb(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

function srgbChannelToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function parseColor(value: string): Rgb {
  const v = value.trim();
  const ok = v.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (ok) {
    const l = Number(ok[1]) / (ok[2] ? 100 : 1);
    return oklchToLinearSrgb(l, Number(ok[3]), Number(ok[4]));
  }
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex?.[1]) {
    const n = Number.parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) =>
      srgbChannelToLinear(x / 255),
    ) as Rgb;
  }
  throw new Error(`Unsupported color: ${value}`);
}

export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: string, bg: string): number {
  const a = relativeLuminance(parseColor(fg));
  const b = relativeLuminance(parseColor(bg));
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Custom properties declared directly in the first `selector { … }` block. */
export function readTokens(css: string, selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No ${selector} block`);
  const end = css.indexOf("\n}", start);
  const body = css.slice(start, end);
  const tokens = new Map<string, string>();
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g))
    if (m[1] && m[2]) tokens.set(m[1], m[2].trim());
  return tokens;
}

/** Resolves `var(--x)` references against the token map(s). */
export function resolveToken(
  name: string,
  ...maps: Map<string, string>[]
): string {
  for (let i = 0; i < 10; i++) {
    const value = maps.map((m) => m.get(name)).find(Boolean);
    if (!value) throw new Error(`Unknown token --${name}`);
    const ref = value.match(/^var\(--([\w-]+)\)$/);
    if (!ref?.[1]) return value;
    name = ref[1];
  }
  throw new Error(`Token cycle at --${name}`);
}
