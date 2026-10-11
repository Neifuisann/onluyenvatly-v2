/**
 * "Bắn zombie" art (B-11): generated PNG/JPG → `public/games/zombie/*.webp`,
 * sized for the game and trimmed where framing doesn't matter. Hero poses and
 * zombies keep their canvas so poses line up.
 *
 *   node scripts/zombie-art.ts <folder with the generated images>
 */
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const src = process.argv[2];
if (!src || !existsSync(src)) throw new Error("Pass the folder of images.");
const out = "public/games/zombie";
mkdirSync(out, { recursive: true });

type Job = {
  name: string;
  file?: string;
  trim?: boolean;
  width: number;
  height?: number;
  quality?: number;
};
const clear = { r: 0, g: 0, b: 0, alpha: 0 };
const jobs: Job[] = [
  ...["idle", "aim", "shoot", "hurt", "win", "lose"].map((p) => ({
    name: `hero-${p}`,
    width: 640,
    height: 640,
  })),
  ...[1, 2, 3].flatMap((k) =>
    ["walk", "hit"].map((p) => ({
      name: `zombie-${k}-${p}`,
      width: 480,
      height: 640,
    })),
  ),
  { name: "barricade", trim: true, width: 200 },
  { name: "ink-shot", trim: true, width: 400 },
  { name: "ammo", trim: true, width: 160 },
  { name: "ammo-empty", trim: true, width: 160 },
  { name: "splat-1", trim: true, width: 420 },
  { name: "splat-2", trim: true, width: 420 },
  { name: "paper-bits", trim: true, width: 560 },
  { name: "bg-sky", file: "bg-sky.jpg", width: 1920, quality: 76 },
  { name: "ground", file: "ground.jpg", width: 640, quality: 72 },
  { name: "title", file: "title.jpg", width: 1600, quality: 70 },
  { name: "win", file: "win.jpg", width: 1400, quality: 78 },
  { name: "lose", file: "lose.jpg", width: 1400, quality: 78 },
];

for (const job of jobs) {
  const file = path.join(src, job.file ?? `${job.name}.png`);
  let img = sharp(file);
  if (job.trim) img = sharp(await img.trim({ threshold: 4 }).toBuffer());
  img = job.height
    ? img.resize(job.width, job.height, { fit: "contain", background: clear })
    : img.resize({ width: job.width, withoutEnlargement: true });
  const target = path.join(out, `${job.name}.webp`);
  const info = await img
    .webp({ quality: job.quality ?? 82, alphaQuality: 90, effort: 6 })
    .toFile(target);
  console.log(
    `${job.name.padEnd(16)} ${info.width}x${info.height}`.padEnd(32),
    `${Math.round(info.size / 1024)} KB`,
  );
}
