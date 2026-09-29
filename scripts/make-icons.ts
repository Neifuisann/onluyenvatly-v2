/**
 * S8-05: the PWA manifest's icons, drawn from the current logo (lucide
 * "atom" on the light theme's `--primary`). Rerun after a logo change:
 *
 *   node scripts/make-icons.ts
 *
 * Writes public/icons/*.png. The favicon is left to the UI work.
 */
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const PRIMARY = "#1e59cd";
const ON_PRIMARY = "#fcfcfc";

const ATOM = `<circle cx="12" cy="12" r="1"/>
<path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/>
<path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/>`;

/** `inset` is the glyph's margin as a share of the side; maskable icons need ≥ 20 %. */
function svg({ rounded, inset }: { rounded: boolean; inset: number }) {
  const size = 512;
  const glyph = size * (1 - 2 * inset);
  const scale = glyph / 24;
  const offset = size * inset;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" rx="${rounded ? 112 : 0}" fill="${PRIMARY}"/>
<g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${ON_PRIMARY}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ATOM}</g>
</svg>`;
}

const png = (source: string, size: number) =>
  sharp(Buffer.from(source)).resize(size, size).png().toBuffer();

const standard = svg({ rounded: true, inset: 0.17 });
const maskable = svg({ rounded: false, inset: 0.26 });

writeFileSync("public/icons/icon-192.png", await png(standard, 192));
writeFileSync("public/icons/icon-512.png", await png(standard, 512));
writeFileSync("public/icons/maskable-512.png", await png(maskable, 512));
console.log("Icons written.");
