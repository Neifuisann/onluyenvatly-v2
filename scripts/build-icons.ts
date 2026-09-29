/**
 * Builds the brand mark and every app icon from the mascot's head
 * (a transparent PNG), so they always match (07 §3.4, §7):
 *
 *   node scripts/build-icons.ts <head-mark.png>
 *
 * Writes public/brand/mark.webp (the logo), public/icons/* (PWA, full-bleed
 * lagoon tile; `maskable` keeps the head inside the 80 % safe zone),
 * src/app/apple-icon.png, src/app/icon.png and src/app/favicon.ico.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const [source] = process.argv.slice(2);
if (!source) {
  console.error("Usage: node scripts/build-icons.ts <head-mark.png>");
  process.exit(1);
}

/** The lagoon teal of the app icon (≈ --primary). */
const TEAL = { r: 23, g: 146, b: 149, alpha: 1 };

// Crop to the visible pixels, then pad to a square.
const { data, info } = await sharp(source)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
let [x0, y0, x1, y1] = [info.width, info.height, 0, 0];
for (let y = 0; y < info.height; y++)
  for (let x = 0; x < info.width; x++)
    if ((data[(y * info.width + x) * 4 + 3] ?? 0) > 24) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
const w = x1 - x0 + 1;
const h = y1 - y0 + 1;
const side = Math.max(w, h);
const clear = { r: 0, g: 0, b: 0, alpha: 0 };
const head = await sharp(source)
  .extract({ left: x0, top: y0, width: w, height: h })
  .extend({
    top: Math.floor((side - h) / 2),
    bottom: Math.ceil((side - h) / 2),
    left: Math.floor((side - w) / 2),
    right: Math.ceil((side - w) / 2),
    background: clear,
  })
  .png()
  .toBuffer();

async function tile(size: number, scale: number, out: string) {
  const inner = Math.round(size * scale);
  const img = await sharp(head).resize(inner, inner).toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: TEAL },
  })
    .composite([{ input: img, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(out);
}

mkdirSync("public/brand", { recursive: true });
mkdirSync("public/icons", { recursive: true });
await sharp(head)
  .resize(160, 160)
  .webp({ quality: 90, alphaQuality: 95 })
  .toFile("public/brand/mark.webp");
await tile(192, 0.8, "public/icons/icon-192.png");
await tile(512, 0.8, "public/icons/icon-512.png");
await tile(512, 0.62, "public/icons/maskable-512.png");
await tile(180, 0.8, "src/app/apple-icon.png");
// The head alone reads best at 16–48 px.
await sharp(head)
  .resize(64, 64)
  .png({ compressionLevel: 9 })
  .toFile("src/app/icon.png");

// favicon.ico holding one 48 px PNG (ICO allows PNG payloads).
const png = await sharp(head)
  .resize(48, 48)
  .png({ compressionLevel: 9 })
  .toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
header.writeUInt8(48, 6); // width
header.writeUInt8(48, 7); // height
header.writeUInt16LE(1, 10); // colour planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18); // data offset
writeFileSync("src/app/favicon.ico", Buffer.concat([header, png]));
console.log("public/brand/mark.webp, src/app/icon.png, src/app/favicon.ico");
