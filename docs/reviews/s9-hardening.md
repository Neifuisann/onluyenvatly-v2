# Sprint 9 hardening and rehearsal

Branch: `feat/S9-hardening-rehearsal`. Started 2026-10-01.

## S9-01: load rehearsal

The k6 scenario uses the actual progressive start form, runner, JSON save and
submit handlers, and result page. A completion counter prevents missing requests
or script exceptions from producing a false pass. There is one iteration per
student, a 60-second staggered start, saves every five seconds and a ten-second
submit burst at five minutes. Thresholds: zero failed checks, HTTP failure rate
below 0.1%, and server-time (`server_ms`, below) p95 below 800 ms per endpoint,
start below 300 ms and submit below 500 ms.

Fixtures use an isolated local database, or an explicitly named Neon staging
host. Never point the app or fixture command at production. Each fixture run
creates a new lesson and accounts, so the 100 and 300 runs do not share attempts.
The manifest contains session credentials and must stay in gitignored `tmp/`;
never upload it as a CI artifact. Default requests use existing sessions to model
students already logged in. `LOGIN=1` adds real login requests; shared-IP limits
remain enabled. Local requests use synthetic IPs and explicit cookie transport
because the production proxy renews Secure cookies on local HTTP.

PowerShell, after starting isolated Postgres and applying migrations:

```powershell
$env:LOAD_DATABASE_URL = 'postgres://postgres:s9-local-only@localhost:54331/postgres'
node --env-file=.env.local scripts/load-fixture.ts --users 100
docker run --rm -v "${PWD}:/work" -w /work `
  -e BASE_URL=http://host.docker.internal:3009 -e TARGET=local -e VUS=100 `
  grafana/k6:1.6.1 run --quiet --summary-export=/work/tmp/load-100.json tests/load/test-day.js
node --env-file=.env.local scripts/load-fixture.ts --verify --users 100
```

Run the production app on port 3009 with `DATABASE_URL` pointing at that same
database and `DATABASE_POOL_MAX=5`. `SESSION_PEPPER` must match the fixture command.
For the second run, create fresh fixtures with `--users 300` and set `VUS=300`.
For staging, use `--staging-host <exact Neon host>`, `TARGET=staging` and its preview
URL. Pass `VERCEL_AUTOMATION_BYPASS_SECRET` privately if protection is enabled.

Verification checks every user's exact final answers, score 7/28 (2.5/10),
submitted status, exactly one rating event linked to the attempt and exactly one
rating update. A wrong count or value exits nonzero. Reports contain counts only.

Local production-build evidence (Postgres 16, pool size 5, Windows/Node 24):

| Run | Completed | Submit p95 | Result p95 | DB verification |
| --- | --- | --- | --- | --- |
| 100 students, five minutes | 100/100 | 61.89 ms | 91.13 ms | All answers, scores and rating events exact |
| 300, original lock order | 300/300 | 5.3 s | 6.95 s | All exact; latency failed |
| 300, shared lesson lock last, isolated rerun | 293/300 | 3.56 s | 4.72 s | Seven unsubmitted attempts; failed |

The submit transaction now updates the shared lesson counter last, preserving
atomicity and retry safety while shortening its lock duration. The existing
34 service tests pass. The 300-student failures remain open; they include HTTP
transport EOFs and are not explained by successful database writes. A shortened
debug run also reproduced EOFs. No load run is accepted on aggregate HTTP error
rate alone: every student must complete and database verification must pass.

GitHub and Vercel authentication were restored. CI has a manual deployed staging
rehearsal with synthetic fixtures and count-only artifacts. Its preview health
check must match the tested commit. Session manifests never become artifacts.

Deployed preview `a145c57`, GitHub run `36793518236`: 100/100 completed,
5,638 checks passed, zero HTTP failures and exact database verification.
Submit p95 356.5 ms passed; start 873.01 ms, runner 988.34 ms and result
1.98 s failed. Save p95 was 315.13 ms. This is not a passing load acceptance.
The Docker runner now writes artifacts as the runner user so summary files
are readable by artifact upload.

Deployed `44f2bc8`, run `36796895052`: 300/300 completed, 16,959 checks,
zero HTTP failures, exact answers/scores and 300 rating events/rows. Latency
failed: start p95 785.03 ms, runner 831.01 ms, save 353.65 ms, submit 4.02 s,
result 2.79 s. Both summary and count artifacts were uploaded successfully.

Deployed `c3035a2` (lesson counter moved out of the submit transaction),
run `36804546442`, 300 students: 300/300, exact verification, zero HTTP
failures; submit p95 425.6 ms passed. Start 750 ms and result 1.39 s failed.

### Server time, not runner distance (2026-10-01)

GitHub-hosted runners are in the Americas (westus, westus3, mexicocentral in
these runs); the functions run in `sin1`. A save, which is one guarded UPDATE,
never took less than 190–280 ms on the client, so client durations were mostly
distance. `tests/load/test-day.js` now takes each VU's fastest `/api/health`
time to first byte as its baseline (same region, one `select 1`) and records
`server_ms` = time to first byte − baseline per endpoint. The 08 §1 and 11 §5
budgets gate on `server_ms`: start < 300 ms, submit < 500 ms, everything else
< 800 ms. Client durations stay in the summary. Runner and result stream after
the cached PPR shell, so their `server_ms` is the shell, and their data reads
are traced separately (`PERFORMANCE_DIAGNOSTICS=1`, preview only, operation
name and duration only).

| Run (deployed) | Completed | DB verification | start | runner | save | submit | result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `81f5310`, 100, run `36809754754` | 100/100 | exact | **747** | 33 | 60 | 140 | 197 |
| `212d27c`, 300, run `36810735769` | 300/300 | exact | **539** | 51 | 57 | 137 | 190 |

`server_ms` p95 in ms; zero failed checks and zero HTTP failures in both runs.
Client p95 from the US runner at 300 students: start 758, runner 827, save 271,
submit 348, result 1,378 ms.

Start is the only failed gate, and our code is not where the time goes. In
the 300-student run, function logs put the session check at p95 10 ms and the
start service (rate limit, open attempt, counts, insert) at p95 64 ms. The
request itself never took less than 390 ms. Save and submit are route
handlers with no such floor (median 11 and 64 ms). The floor appears only on
the Server Action POST to the PPR lesson page, which is the platform's PPR
action path. Locally (no PPR resume) the same start took p95 19.6 ms. The fix is
to post the start form to a route handler like save and submit, with a
redirect back for errors when JavaScript is off. That changes the start
button's UX and its E2E specs, so it is left as a follow-up rather than
folded into this PR.

The submit route no longer fails a committed grade when the post-commit
counter write fails: it logs the error code and the daily flush repairs the
counter.

## S9-02: performance

The bundle checker includes shared framework and entry chunks at gzip size.
The explanations admin page fell from 395.4 KB to 172.3 KB after a browser pacing
constant stopped importing Node cryptography polyfills and Zod. Public media,
avatar limits and question-type constants likewise have browser-safe modules.
The root error controls load on demand. The runner is 171.7 KB against 180 KB;
14 of 34 routes still exceed their budgets, including student catalog/overview.

Local production build of the current head (2026-10-01): 9 of 34 routes over
budget, all student pages at 157–168 KB against 150 KB (lesson overview 167.9,
result 166.2, settings 163.9, review 159.3, register 158.8, change-password
158.4, login 158.1, profile 157.7, `/ly-thuyet` 157.2). The dashboard and catalog
pass at about 144 KB. Every failing route carries the same 8.4 KB chunk, which is
`tailwind-merge`, reached through `cn()` in 25 client components. A client-only
`cn` without merging would bring login, profile and `/ly-thuyet` under budget,
but it changes class-conflict resolution and needs a visual pass, so it is not
in this PR.

Deployed three-run mobile Lighthouse (CI run `36806327017`, `fecc62c`): `/`
performance 100, LCP 1.69 s; `/lessons` 89, LCP 3.67 s; runner 95, LCP 2.77 s
(target 1.8 s). CLS is zero on all three.

Initial mobile Lighthouse on the local production build: performance 85,
accessibility 100, LCP 4.14 s, CLS 0. This is a failure of the performance target.
Display-font preloading has since been reduced; fresh measurements are pending.
LHCI supplies three-run median assertions; Windows CLI cleanup errors prevented
its standard collector finishing, so the initial report used Lighthouse's API
with a Playwright-owned browser. No deployed cache-log acceptance yet.

Deployed mobile Lighthouse 13.5: performance 93, accessibility 100, LCP
1.506 s, CLS zero, TBT 116.5 ms and static response 59 ms. LCP/CLS pass this
single measurement, but the performance score and three-run/authenticated
route acceptance remain open.

## S9-03: security

Full dependency audit: zero high/critical findings, one moderate finding in
Drizzle's development-only esbuild dependency. LHCI's old Lighthouse/ZIP
extractor was replaced through pinned overrides. Three new checks pass for
transitive client/server boundaries, secret environment access and backup
retention. Existing authz tests discover every admin action; the E2E matrix
covers student/visitor routes and answer-safe runner traffic. Full suite and ZAP
suite passes (1,154 tests). Deployed ZAP baseline: zero high risks, seven warning
categories, retained in `tmp/zap/report.json` for review. Gitleaks 8.30.1 found
no secrets in the branch history or staged security changes.
ZAP refuses an unreachable or
protected preview and fails on high risks; warning reports remain visible.

## S9-04: backup and restore

Nightly workflow: scoped custom-format Postgres dump, age encryption, R2 upload,
then pruning to 30 daily and 12 monthly dated copies. Retention tests pass.
The restore workflow refuses production/shared staging hosts and nonempty
targets, decrypts the newest daily copy, restores transactionally without
owners/privileges and verifies counts, submitted-answer alignment, published
version links, Zod questions and RLS. A local age-encrypted round trip passed:
decrypted bytes matched the source dump; isolated Postgres restore had 1,306
users, seven lessons/versions, 1,306 attempts, 1,287 rating events and 27,027
mistakes, with zero sanity violations. The drill skips only the public-schema
creation entry because fresh Postgres already supplies that schema.
Live R2/Neon acceptance remains pending: R2/age/isolated restore credentials
are not configured in GitHub.

## S9-05: maintenance and monitoring

Daily maintenance grades overdue attempts using their last saved answers and
the existing idempotent submit transaction, removes expired sessions and rate
limits, protects every referenced lesson version, trims old IP/guard metadata,
and cleans imports. Integration tests cover retries and retention boundaries.
Migration `0012` supports private-data retention. Quota checks report database,
storage and configured AI usage, warning at 60 percent through a GitHub issue.

Sentry SDK 11 is optional on server and browser. Event/span sanitizers retain
only generic error information, safe stack filenames and trace identifiers;
user data, requests, cookies, headers, bodies, SQL, content and breadcrumbs are
dropped. Explicit SDK data-collection settings disable personal data. No DSN
is configured, so receipt of a real alert is still unverified. UptimeRobot and
Vercel usage alerts also require external account configuration.

The quota alert path is verified: the manual `quota` rehearsal (CI run
`36803828406`) read the production snapshot and opened the test alert issue
#21 ("Daily quota budget alert", test alert, no budget exceeded). The snapshot
was 148 MB of database, 1,287 attempts that day and no AI calls.

## S9-06: legacy history

Implementation includes paged, read-only source snapshots, transactional
attempt upserts, immutable historical versions, rating-history identifiers,
unambiguous event links, native pilot rating replay and chronological mistakes.
The verifier compares source counts and recorded answers/marks, all version
schemas and safe projections, ratings/history, 20 student samples and tied
leaderboard rows. Eight focused migration/normalization tests pass; the full
suite and coverage gates pass with 1,163 tests.

A read-only census found old sparse results and missing embedded answer keys.
Those records are reported as skips rather than reconstructed. The first
local full dry run lost its source connection after a host interruption;
the target rolled back to zero migrated users.

The retry completed on 2026-10-01 into an isolated local Postgres
(`localhost:54331`), with v1 read-only. Counts only:

| Entity | v1 | v2 | Skipped |
| --- | --- | --- | --- |
| Students → users | 292 | 292 | 0 |
| Lessons | 172 | 171 | 1 (`quiz_game` placeholder) |
| Questions | 5,234 | 5,234 | 0 errors, 4 warnings (empty true/false lead-ins) |
| Results → attempts | 24,268 | 23,914 | 354 |
| Rating history → events | | 23,471 | |
| Ratings | | 273 | |
| Historical versions | | 433 new, 611 valid in total | |
| Mistakes rebuilt | | 101,599 | |

Skips are reported, never reconstructed: 235 results whose answer key no
longer resolves, 32 unresolved choices, 23 invalid embedded questions, 7
invalid scores, 55 belonging to students who were not migrated and 2 whose lesson
was not migrated. `verify-migration.ts` reported `automatedOk: true` with no
failures (counts, recorded answers and marks, version schemas, ratings and
history, 20 sampled students, tied leaderboard rows). Its three manual gates
remain open: controlled-account password checks, teacher review and the media
copy.

The same rehearsal then ran into the v2 production project through
`migrate.yml` (mode `rehearsal`, writes on, production environment):
run `36803938521` on `b2945fd` applied the schema and imported the same
counts (23,914 attempts, 433 historical versions, 23,471 events, 273 ratings,
101,599 mistakes). Its verify step refused to run because both URLs were
Supabase shared-pooler hosts. `6a3e958` tells projects apart by the pooler
user, and the verify-only run `36806966248` against production reported
`automatedOk: true` with no failures and the same counts (604 valid versions).

## Remaining live acceptance

| Task | Status | Open |
| --- | --- | --- |
| S9-01 | 🟡 100 and 300 deployed, exact DB verification, all but one server-time gate pass | Start server time (PPR action floor ~390 ms; move start to a route handler) |
| S9-02 | 🟡 Runner within budget, `/` Lighthouse passes | Several student routes over 150 KB; `/lessons` and runner LCP; Vercel cache-log review |
| S9-03 | ✅ Zero high findings (audit, ZAP baseline, gitleaks, boundary checks) | Review the seven ZAP warning categories |
| S9-04 | 🟡 Workflows and a local encrypted round trip pass | R2, age and restore-target secrets in GitHub, then the live drill into Neon |
| S9-05 | 🟡 Cron maintenance live, quota test alert received (#21) | Sentry DSN, UptimeRobot monitor, Vercel usage alerts |
| S9-06 | 🟡 Full real-data rehearsal into the v2 production project, automated verification green | Controlled-account password checks, media copy, teacher review |

M6 is not launch-ready until these gates have evidence.
