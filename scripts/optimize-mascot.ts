/**
 * Converts mascot/illustration PNGs into the WebP files the UI serves from
 * `public/mascot/` (07 §3.4). Static art is sized here once, so pages use a
 * plain <img> and never spend the image-optimization quota (ADR-006).
 *
 *   node scripts/optimize-mascot.ts <source-dir> [name=file.png ...]
 *
 * Without name mappings every PNG in <source-dir> is converted under its own
 * name. The long side is capped at 512 px (2× the largest display size).
 */
import { mkdirSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";
import sharp from "sharp";

const [source, ...pairs] = process.argv.slice(2);
if (!source) {
  console.error(
    "Usage: node scripts/optimize-mascot.ts <source-dir> [name=file.png ...]",
  );
  process.exit(1);
}

const OUT = "public/mascot";
const MAX = 512;
mkdirSync(OUT, { recursive: true });

const jobs: [string, string][] = pairs.length
  ? pairs.map((p) => {
      const [name, file] = p.split("=");
      if (!name || !file) throw new Error(`Bad mapping: ${p}`);
      return [name, file];
    })
  : readdirSync(source)
      .filter((f) => extname(f).toLowerCase() === ".png")
      .map((f) => [basename(f, extname(f)), f]);

for (const [name, file] of jobs) {
  const out = join(OUT, `${name}.webp`);
  const info = await sharp(join(source, file))
    .resize(MAX, MAX, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86, alphaQuality: 90, effort: 6 })
    .toFile(out);
  console.log(
    `${out}  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(1)} KB`,
  );
}
