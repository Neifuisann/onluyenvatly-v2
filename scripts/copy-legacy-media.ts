/**
 * S2-05 follow-up: copy the v1 lesson images (question figures and covers)
 * into the v2 `media` bucket on their own. The data migration runs with
 * `--skip-media`, so production served lessons whose image paths pointed at
 * nothing. This never writes lesson, user or history rows.
 *
 *   node --env-file=<file> scripts/copy-legacy-media.ts --dry-run
 *   node --env-file=<file> scripts/copy-legacy-media.ts
 *
 * Env: V1_DATABASE_URL (read in a READ ONLY transaction); SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY of the v2 project (not needed for --dry-run);
 * optional DATABASE_URL_DIRECT of v2, to record `media` rows (quota) and to
 * check that every image the v2 lessons reference now loads. Creates the
 * public `media` and private `imports` buckets when missing (ADR-006).
 * Idempotent: objects already in the bucket are left alone. Prints counts and
 * paths only, never secrets.
 */
import { parseArgs } from "node:util";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema.ts";
import { copyAll, ensureBucket } from "./lib/media-copy.ts";
import { legacyMediaJobs, type V1Row } from "./lib/migrate-legacy.ts";

const { values: args } = parseArgs({
  options: { "dry-run": { type: "boolean", default: false } },
});
const dryRun = args["dry-run"] ?? false;

const v1Url = process.env.V1_DATABASE_URL;
const v2Url = process.env.DATABASE_URL_DIRECT;
const storageUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicBase =
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL?.replace(/\/+$/, "") ??
  (storageUrl ? `${storageUrl}/storage/v1/object/public/media` : undefined);

if (!v1Url) {
  console.error("Set V1_DATABASE_URL.");
  process.exit(1);
}
if (!dryRun && (!storageUrl || !serviceKey)) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (v2).");
  process.exit(1);
}
if (v2Url && new URL(v1Url).host === new URL(v2Url).host) {
  const ref = (u: string) => decodeURIComponent(new URL(u).username);
  if (ref(v1Url) === ref(v2Url)) {
    console.error("V1_DATABASE_URL and DATABASE_URL_DIRECT match. Refusing.");
    process.exit(1);
  }
}

const encodePath = (p: string) =>
  p.split("/").map(encodeURIComponent).join("/");

/** HEAD each URL (8 at a time); returns the ones that don't answer 2xx. */
async function unreachable(urls: readonly string[]): Promise<string[]> {
  const bad: string[] = [];
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const url = urls[next++] as string;
      const res = await fetch(url, { method: "HEAD" }).catch(() => null);
      if (!res?.ok) bad.push(url);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  return bad;
}

const v1 = postgres(v1Url, { max: 1, prepare: false, idle_timeout: 5 });
const v2Client = v2Url
  ? postgres(v2Url, { max: 1, prepare: false, onnotice: () => {} })
  : null;
let failed = false;

try {
  const rows = await v1.begin(
    "read only",
    (tx) =>
      tx<V1Row[]>`select id, questions, lesson_image from lessons order by id`,
  );
  const jobs = legacyMediaJobs(rows);
  const covers = jobs.filter((j) => j.source.startsWith("data:")).length;
  console.log(
    `v1: ${rows.length} lessons → ${jobs.length} images (${covers} base64 covers)`,
  );

  if (dryRun) {
    const urls = jobs
      .map((j) => j.source)
      .filter((s) => !s.startsWith("data:"));
    const bad = await unreachable(urls);
    console.log(
      `v1 sources: ${urls.length - bad.length}/${urls.length} reachable`,
    );
    for (const u of bad.slice(0, 20)) console.log(`  unreachable: ${u}`);
    if (publicBase) {
      const missing = await unreachable(
        jobs.map((j) => `${publicBase}/${encodePath(j.path)}`),
      );
      console.log(
        `v2 bucket: ${jobs.length - missing.length}/${jobs.length} already there`,
      );
    }
  } else if (storageUrl && serviceKey) {
    const target = { url: storageUrl, serviceKey, bucket: "media" };
    console.log(
      `bucket media: ${await ensureBucket(target, {
        id: "media",
        public: true,
        // Legacy files can be up to 10 MB (media-copy); uploads stay ≤ 2 MB.
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: ["image/*"],
      })}`,
    );
    console.log(
      `bucket imports: ${await ensureBucket(target, { id: "imports", public: false })}`,
    );

    console.log(`Copying ${jobs.length} images…`);
    const results = await copyAll(jobs, target);
    const ok = results.filter((r) => r.status !== "failed");
    const copied = ok.filter((r) => r.status === "copied").length;
    const bad = results.filter((r) => r.status === "failed");
    console.log(
      `media: copied ${copied}, existing ${ok.length - copied}, failed ${bad.length}`,
    );
    for (const r of bad) console.log(`  failed ${r.path}: ${r.error}`);
    failed = bad.length > 0;

    if (v2Client && ok.length > 0) {
      const db = drizzle({ client: v2Client, schema });
      for (let i = 0; i < ok.length; i += 500)
        await db
          .insert(schema.media)
          .values(
            ok.slice(i, i + 500).map((r) => ({ path: r.path, bytes: r.bytes })),
          )
          .onConflictDoNothing({ target: schema.media.path });
      console.log(`media rows: ensured ${ok.length}`);
    }
  }

  // Every image a v2 lesson points at (covers, `image` fields and inline
  // `media:` tokens of the current version) must load.
  if (v2Client && publicBase) {
    const refs = await v2Client<{ path: string }[]>`
      select cover_path as path from lessons where cover_path is not null
      union
      select m[1] from lessons l
        join lesson_versions v on v.id = l.current_version_id,
        regexp_matches(v.questions::text, '"path":\\s*"([^"]+)"', 'g') m
      union
      select m[1] from lessons l
        join lesson_versions v on v.id = l.current_version_id,
        regexp_matches(v.questions::text, 'media:([A-Za-z0-9][A-Za-z0-9/_.-]*)', 'g') m`;
    const paths = refs.map((r) => r.path);
    const missing = await unreachable(
      paths.map((p) => `${publicBase}/${encodePath(p)}`),
    );
    console.log(
      `v2 references: ${paths.length - missing.length}/${paths.length} load`,
    );
    for (const u of missing.slice(0, 50))
      console.log(`  missing: ${u.slice(publicBase.length + 1)}`);
    if (!dryRun && missing.length > 0) failed = true;
  }
} finally {
  await v1.end();
  await v2Client?.end();
}
process.exit(failed ? 2 : 0);
