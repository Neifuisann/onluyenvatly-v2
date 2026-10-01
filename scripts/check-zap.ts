import { readFile } from "node:fs/promises";
import { z } from "zod";

const report = z
  .object({
    site: z.array(
      z.object({
        alerts: z.array(
          z.object({ pluginid: z.string(), riskcode: z.coerce.number() }),
        ),
      }),
    ),
  })
  .parse(JSON.parse(await readFile(process.argv[2] ?? "", "utf8")));
if (!report.site.length) throw new Error("ZAP scanned no sites.");
const high = report.site
  .flatMap((site) => site.alerts)
  .filter((a) => a.riskcode >= 3);
console.log(
  `${high.length} high findings; plugin IDs: ${high.map((a) => a.pluginid).join(", ") || "none"}`,
);
if (high.length) process.exitCode = 1;
