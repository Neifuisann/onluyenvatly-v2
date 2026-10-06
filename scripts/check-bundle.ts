/** S9-02: gzip first-load entry chunks, including the shared framework. */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { runInNewContext } from "node:vm";
import { gzipSync } from "node:zlib";
import { z } from "zod";

const manifestSchema = z.object({
  entryJSFiles: z.record(z.string(), z.array(z.string())),
});
const root = z
  .object({ rootMainFiles: z.array(z.string()) })
  .parse(JSON.parse(await readFile(".next/build-manifest.json", "utf8")));
async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? walk(join(dir, e.name))
          : Promise.resolve(
              e.name.endsWith("page_client-reference-manifest.js")
                ? [join(dir, e.name)]
                : [],
            ),
      ),
    )
  ).flat();
}
const sizes = new Map<string, number>();
const reports = [];
for (const path of await walk(".next/server/app")) {
  const context: { __RSC_MANIFEST?: Record<string, unknown> } = {};
  runInNewContext(await readFile(path, "utf8"), context, { timeout: 1000 });
  for (const [page, raw] of Object.entries(context.__RSC_MANIFEST ?? {})) {
    const manifest = manifestSchema.parse(raw);
    const route =
      page.replace(/\/\([^/]+\)/g, "").replace(/\/page$/, "") || "/";
    // Teacher-only screens: the admin area and the game projector (B-05),
    // opened on a desktop or a classroom PC, never a student's phone.
    const limitKB = /^\/(admin|host)(\/|$)/.test(route)
      ? 350
      : /^\/attempts\/\[[^/]+\]$/.test(route)
        ? 180
        : 150;
    const chunks = new Set([
      ...root.rootMainFiles,
      // Generated metadata entries can share chunks with hydrated controls.
      // Browser measurements confirmed these chunks load on ordinary pages.
      ...Object.values(manifest.entryJSFiles).flat(),
    ]);
    let bytes = 0;
    for (const chunk of chunks) {
      if (!chunk.startsWith("static/") || chunk.includes(".."))
        throw new Error("Invalid build chunk path");
      let size = sizes.get(chunk);
      if (size === undefined) {
        size = gzipSync(await readFile(join(".next", chunk))).length;
        sizes.set(chunk, size);
      }
      bytes += size;
    }
    reports.push({
      route,
      bytes,
      limitKB,
      ok: bytes < limitKB * 1024,
      manifest: relative(".next", path),
    });
  }
}
if (reports.length === 0) throw new Error("No app route manifests found");
await mkdir("tmp", { recursive: true });
await writeFile("tmp/bundle-budget.json", JSON.stringify(reports, null, 2));
for (const r of reports.sort((a, b) => b.bytes - a.bytes).slice(0, 12))
  console.log(
    `${r.ok ? "PASS" : "FAIL"} ${r.route}: ${(r.bytes / 1024).toFixed(1)} / ${r.limitKB} KB gzip`,
  );
const failures = reports.filter((r) => !r.ok);
console.log(
  `${reports.length} routes checked, ${failures.length} over budget.`,
);
if (failures.length) process.exitCode = 1;
