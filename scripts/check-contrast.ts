/**
 * S1-01: every text/background token pair must reach WCAG AA (07 §3.1).
 *
 *   pnpm check:contrast
 *
 * Reads src/app/globals.css, checks light (:root) and dark (.dark), and exits
 * non-zero if any pair is below its minimum. Runs in CI.
 */
import { readFileSync } from "node:fs";
import { contrastRatio, readTokens, resolveToken } from "./lib/contrast.ts";

/** [foreground, background, minimum ratio]. 3:1 is for UI parts, not text. */
const PAIRS: Array<[string, string, number]> = [
  ["foreground", "background", 4.5],
  ["foreground", "surface", 4.5],
  ["foreground", "muted", 4.5],
  ["muted-foreground", "background", 4.5],
  ["muted-foreground", "surface", 4.5],
  ["muted-foreground", "muted", 4.5],
  ["primary", "background", 4.5], // links
  ["primary", "surface", 4.5],
  ["primary-foreground", "primary", 4.5],
  ["foreground", "primary-soft", 4.5],
  ["primary", "primary-soft", 4.5],
  ["accent-foreground", "accent", 4.5],
  ["success-foreground", "success", 4.5],
  ["success-text", "surface", 4.5],
  ["success-text", "background", 4.5],
  ["danger-foreground", "danger", 4.5],
  ["danger-text", "surface", 4.5],
  ["danger-text", "background", 4.5],
  ["warning-foreground", "warning", 4.5],
  ["warning-text", "surface", 4.5],
  ["warning-text", "background", 4.5],
  ["primary", "muted", 4.5],
  ["ink-foreground", "ink", 4.5],
  ["ink-muted", "ink", 4.5],
  ["accent-text", "accent-soft", 4.5],
  ["accent-text", "surface", 4.5],
  ["foreground", "accent-soft", 4.5],
  ["success-text", "success-soft", 4.5],
  ["danger-text", "danger-soft", 4.5],
  ["foreground", "peach", 4.5],
  ["input", "surface", 3], // form control borders (WCAG 1.4.11)
  ["ring", "background", 3],
  ["ring", "surface", 3],
];

const css = readFileSync(
  new URL("../src/app/globals.css", import.meta.url),
  "utf8",
);
const light = readTokens(css, ":root");
const dark = readTokens(css, ".dark");

let failures = 0;
for (const [theme, maps] of [
  ["light", [light]],
  ["dark", [dark, light]],
] as const) {
  for (const [fg, bg, min] of PAIRS) {
    const ratio = contrastRatio(
      resolveToken(fg, ...maps),
      resolveToken(bg, ...maps),
    );
    const pass = ratio >= min;
    if (!pass) failures++;
    console.log(
      `${pass ? "ok  " : "FAIL"} ${theme.padEnd(5)} ${fg} on ${bg}: ${ratio.toFixed(2)} (min ${min})`,
    );
  }
}

if (failures > 0) {
  console.error(`\n${failures} pair(s) below the minimum contrast.`);
  process.exit(1);
}
console.log("\nAll token pairs pass.");
