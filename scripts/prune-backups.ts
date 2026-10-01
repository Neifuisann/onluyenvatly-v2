import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { backupsToPrune } from "../src/features/operations/domain/backup-retention.ts";

const inventory = z
  .object({
    Contents: z.array(z.object({ Key: z.string() })).optional(),
  })
  .parse(JSON.parse(await readFile(process.argv[2] ?? "", "utf8")));
const objects = backupsToPrune((inventory.Contents ?? []).map((o) => o.Key));
await writeFile(
  process.argv[3] ?? "",
  JSON.stringify({
    Objects: objects.map((Key) => ({ Key })),
    Quiet: true,
  }),
);
console.log(`${objects.length} expired backup objects.`);
