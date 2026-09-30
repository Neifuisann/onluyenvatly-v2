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

## S9-03: security

Production dependency audit: zero vulnerabilities. Five new checks pass for
transitive client/server boundaries, secret environment access and backup
retention. Existing authz tests discover every admin action; the E2E matrix
covers student/visitor routes and answer-safe runner traffic. Full suite and ZAP
evidence will be recorded after validation. ZAP refuses an unreachable or
protected preview and fails on high risks; warning reports remain visible.

## S9-04: backup and restore

Nightly workflow: scoped custom-format Postgres dump, age encryption, R2 upload,
then pruning to 30 daily and 12 monthly dated copies. Retention tests pass.
The restore workflow refuses production/shared staging hosts and nonempty
targets, decrypts the newest daily copy, restores transactionally without
owners/privileges and verifies counts, submitted-answer alignment, published
version links, Zod questions and RLS. Local round trip and live R2/Neon drill
remain pending. R2/age/isolated restore credentials are not configured in GitHub.

## Remaining live acceptance

- S9-01: deployed staging load runs and database verification.
- S9-02: deployed mobile Lighthouse, authenticated route budgets, Vercel cache logs.
- S9-03: preview ZAP baseline and zero unresolved high findings.
- S9-04: encrypted R2 backup and restore into an isolated Neon branch.
- S9-05: Sentry/UptimeRobot/quota/usage alerts received by the owner.
- S9-06: full real-data rehearsal, controlled-account password checks and teacher review.

M6 is not launch-ready until these gates have evidence.
