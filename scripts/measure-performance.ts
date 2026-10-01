/** S9-02: synthetic accounts only; reports contain metrics, never cookies or DOM. */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";
import { z } from "zod";

const origin = new URL(process.env.BASE_URL ?? "http://localhost:3009").origin;
const fixture = z
  .object({
    lessonId: z.number(),
    users: z.array(z.object({ token: z.string() })).min(1),
  })
  .parse(JSON.parse(await readFile("tmp/load-fixture.json", "utf8")));
const token = fixture.users[0]?.token;
if (!token) throw new Error("Synthetic performance fixture missing.");
const cookie = {
  name: "ovl_session",
  value: token,
  url: origin,
  secure: origin.startsWith("https:"),
  httpOnly: true,
};
const browser = await chromium.launch({
  headless: true,
  args: ["--remote-debugging-port=9333"],
});
const measurements: {
  route: string;
  gzipKB: number;
  ttfbMs: number;
  ok: boolean;
}[] = [];
const lighthouseReports: {
  route: string;
  performance: number;
  accessibility: number;
  lcpMs: number;
  cls: number;
  ok: boolean;
}[] = [];
let stage = "prepare";
try {
  const context = await browser.newContext();
  await context.addCookies([cookie]);
  const page = await context.newPage();
  await page.goto(`${origin}/lessons/${fixture.lessonId}`);
  await page
    .locator('form:has(input[name="lessonId"]) button[type="submit"]')
    .click();
  await page.waitForURL(/\/attempts\/[a-f0-9-]+$/);
  const attemptPath = new URL(page.url()).pathname;
  await context.close();

  stage = "browser metrics";
  async function measure(path: string, route: string, authenticated = true) {
    const c = await browser.newContext({
      viewport: { width: 360, height: 740 },
    });
    try {
      if (authenticated) await c.addCookies([cookie]);
      const p = await c.newPage();
      const sizes = new Map<string, number>();
      const responses: Promise<void>[] = [];
      p.on("response", (response) => {
        if (
          response.request().resourceType() !== "script" ||
          !response.url().startsWith(`${origin}/_next/`)
        )
          return;
        responses.push(
          (async () => {
            if (!response.ok()) throw new Error("Script download failed.");
            sizes.set(
              new URL(response.url()).pathname,
              gzipSync(await response.body()).length,
            );
          })(),
        );
      });
      const response = await p.goto(origin + path, {
        waitUntil: "networkidle",
      });
      if (!response?.ok() || new URL(p.url()).pathname !== path)
        throw new Error("Unexpected route response.");
      await Promise.all(responses);
      const gzipKB = [...sizes.values()].reduce((sum, n) => sum + n, 0) / 1024;
      const ttfbMs = await p.evaluate(() => {
        const entry = performance.getEntriesByType(
          "navigation",
        )[0] as PerformanceNavigationTiming;
        return entry.responseStart - entry.requestStart;
      });
      const limit = route === "/attempts/[id]" ? 180 : 150;
      measurements.push({
        route,
        gzipKB,
        ttfbMs,
        ok: sizes.size > 0 && gzipKB < limit,
      });
    } finally {
      await c.close();
    }
  }
  await measure("/", "/", false);
  await measure("/login", "/login", false);
  await measure("/register", "/register", false);
  for (const path of [
    "/dashboard",
    "/lessons",
    "/leaderboard",
    "/profile",
    "/review",
    "/settings",
  ])
    await measure(path, path);
  await measure(`/lessons/${fixture.lessonId}`, "/lessons/[id]");
  await measure(attemptPath, "/attempts/[id]");

  stage = "mobile Lighthouse";
  // Lighthouse uses Chrome's default context. Set a host-only cookie there;
  // do not pass Cookie as a global extra header to third-party resources.
  const connected = await chromium.connectOverCDP("http://127.0.0.1:9333");
  const defaultContext = connected.contexts()[0];
  if (!defaultContext) throw new Error("Default browser context missing.");
  await defaultContext.addCookies([cookie]);
  const require = createRequire(import.meta.resolve("@lhci/cli/package.json"));
  const { default: lighthouse } = await import(
    pathToFileURL(require.resolve("lighthouse")).href
  );
  const reportSchema = z.object({
    finalDisplayedUrl: z.url(),
    categories: z.object({
      performance: z.object({ score: z.number() }),
      accessibility: z.object({ score: z.number() }),
    }),
    audits: z.record(
      z.string(),
      z.object({ numericValue: z.number().optional() }),
    ),
  });
  const median = (values: number[]) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ??
    Infinity;
  for (const [path, route] of [
    [attemptPath, "/attempts/[id]"],
    ["/", "/"],
    ["/lessons", "/lessons"],
  ]) {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const blank = await defaultContext.newPage();
      const session = await defaultContext.newCDPSession(blank);
      await session.send("Network.clearBrowserCache");
      await session.detach();
      await blank.close();
      const result = await lighthouse(origin + path, {
        port: 9333,
        output: "json",
        logLevel: "error",
        disableStorageReset: true,
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 360,
          height: 740,
          deviceScaleFactor: 1,
          disabled: false,
        },
      });
      const r = reportSchema.parse(result.lhr);
      if (new URL(r.finalDisplayedUrl).pathname !== path)
        throw new Error("Lighthouse route redirected.");
      runs.push({
        performance: r.categories.performance.score,
        accessibility: r.categories.accessibility.score,
        lcpMs: r.audits["largest-contentful-paint"]?.numericValue ?? Infinity,
        cls: r.audits["cumulative-layout-shift"]?.numericValue ?? Infinity,
      });
    }
    const row = {
      route: route ?? "",
      performance: median(runs.map((r) => r.performance)),
      accessibility: median(runs.map((r) => r.accessibility)),
      lcpMs: median(runs.map((r) => r.lcpMs)),
      cls: median(runs.map((r) => r.cls)),
    };
    lighthouseReports.push({
      ...row,
      ok:
        row.performance >= 0.95 &&
        row.accessibility === 1 &&
        row.lcpMs < 1800 &&
        row.cls < 0.05,
    });
  }
  stage = "synthetic submit";
  const c = await browser.newContext();
  await c.addCookies([cookie]);
  const submitted = await c.request.post(
    `${origin}${attemptPath.replace("/attempts/", "/api/attempts/")}/submit`,
    {
      headers: { Origin: origin },
      data: {
        answers: Array.from({ length: 28 }, (_, i) => "ABCD"[i % 4]),
        flagged: [],
        clientSubmitId: randomUUID(),
      },
    },
  );
  const result = z
    .object({
      ok: z.literal(true),
      data: z.object({ score: z.literal(7), score10: z.literal(2.5) }),
    })
    .safeParse(await submitted.json());
  if (!submitted.ok() || !result.success)
    throw new Error("Synthetic grading failed.");
  await c.close();
  await measure(`${attemptPath}/result`, "/attempts/[id]/result");
  await measure("/profile", "/profile");
  await mkdir("tmp", { recursive: true });
  const report = {
    measurements,
    lighthouse: lighthouseReports,
    fieldInpVerified: false,
    cacheLogsVerified: false,
    ok: measurements.every((r) => r.ok) && lighthouseReports.every((r) => r.ok),
  };
  await writeFile(
    "tmp/performance-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
  if (!report.ok) process.exitCode = 1;
} catch {
  console.error(
    JSON.stringify({ evt: "performance_rehearsal_failure", stage }),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
