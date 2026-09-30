/**
 * S8-01: render the static social preview with the app's own fonts, tokens
 * and mascot. Run against a local app: node scripts/build-social-image.ts
 * [http://localhost:3100]. No runtime image generation or external artwork.
 */
import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import {
  landingCopy,
  onboardingCopy,
  publicCopy,
} from "../src/lib/messages.ts";

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  await page.goto(process.argv[2] ?? "http://localhost:3100", {
    waitUntil: "networkidle",
  });
  await page.evaluate(
    ({ eyebrow, headline, footer }) => {
      const preview = document.createElement("div");
      preview.id = "social-preview";
      preview.style.cssText =
        "position:fixed;inset:0;z-index:99999;width:1200px;height:630px;" +
        "display:flex;align-items:center;padding:64px;gap:24px;" +
        "background:var(--ink);color:var(--ink-foreground);";
      const copy = document.createElement("div");
      copy.style.cssText = "width:660px;flex-shrink:0;";
      const label = document.createElement("p");
      label.textContent = eyebrow;
      label.style.cssText =
        "font-size:20px;font-weight:600;color:var(--ink-muted);margin-bottom:28px;";
      const title = document.createElement("h1");
      title.style.cssText =
        "font-family:var(--font-display);font-size:66px;font-weight:700;" +
        "line-height:1.16;letter-spacing:-1.5px;text-wrap:balance;";
      for (const [i, line] of headline.entries()) {
        const span = document.createElement("span");
        span.textContent = line;
        span.style.cssText = `display:block;${i === 1 ? "color:var(--accent);" : ""}`;
        title.append(span);
      }
      const brand = document.createElement("p");
      brand.textContent = footer.split(" · ")[0] ?? footer;
      brand.style.cssText = "font-size:24px;font-weight:600;margin-top:40px;";
      copy.append(label, title, brand);
      const mascot = document.createElement("img");
      mascot.src = "/mascot/rocket.webp";
      mascot.alt = "";
      mascot.style.cssText = "width:380px;height:440px;object-fit:contain;";
      preview.append(copy, mascot);
      document.body.append(preview);
    },
    {
      eyebrow: landingCopy.eyebrow,
      headline: onboardingCopy.headline,
      footer: publicCopy.footer,
    },
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.querySelectorAll("#social-preview img"), (img) =>
        (img as HTMLImageElement).decode(),
      ),
    );
  });
  await page.locator("#social-preview").screenshot({
    path: "src/app/opengraph-image.png",
    style: "nextjs-portal { display: none !important; }",
  });
  await writeFile(
    "src/app/opengraph-image.alt.txt",
    `${publicCopy.footer}. ${onboardingCopy.headline.join(" ")}\n`,
  );
} finally {
  await browser.close();
}
