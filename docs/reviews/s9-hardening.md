# Sprint 9 hardening and rehearsal

Branch: `feat/S9-hardening-rehearsal`. Started 2026-10-01.

## S9-01: load rehearsal

The k6 scenario uses the actual progressive start form, runner, JSON save and
submit handlers, and result page. A completion counter prevents missing requests
or script exceptions from producing a false pass. There is one iteration per
student, a 60-second staggered start, saves every five seconds and a ten-second
submit burst at five minutes. Thresholds: zero failed checks, HTTP failure rate
below 0.1%, endpoint p95 below 800 ms, start below 300 ms and submit below 500 ms.

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

## S9-02: performance

The bundle checker includes shared framework and entry chunks at gzip size.
The explanations admin page fell from 395.4 KB to 172.3 KB after a browser pacing
constant stopped importing Node cryptography polyfills and Zod. Public media,
avatar limits and question-type constants likewise have browser-safe modules.
The root error controls load on demand. The runner is 171.7 KB against 180 KB;
14 of 34 routes still exceed their budgets, including student catalog/overview.

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
the target rolled back to zero migrated users. A retry is running. No real
data migration acceptance is claimed yet.

## Remaining live acceptance

- S9-01: deployed staging load runs and database verification.
- S9-02: deployed mobile Lighthouse, authenticated route budgets, Vercel cache logs.
- S9-03: preview ZAP baseline and zero unresolved high findings.
- S9-04: encrypted R2 backup and restore into an isolated Neon branch.
- S9-05: Sentry/UptimeRobot/quota/usage alerts received by the owner.
- S9-06: full real-data rehearsal, controlled-account password checks and teacher review.

M6 is not launch-ready until these gates have evidence.
