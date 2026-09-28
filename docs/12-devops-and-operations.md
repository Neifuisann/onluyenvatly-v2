# 12 — DevOps & Operations

## 1. Accounts & services (all free)

| Service | Plan | Purpose | Notes |
|---|---|---|---|
| GitHub | Free, **personal account** repo | Code, CI, backups workflow | Vercel Hobby **can't connect repos owned by a GitHub organization**, so keep the repo under a personal account. Private repos get 2,000 Actions minutes/month |
| Vercel | Hobby | Hosting v2 (new project `onluyenvatly-v2`) | Non-commercial only (ADR-001) |
| Supabase | Free | Prod DB + Storage (v2 project, Singapore) | 2 active projects max: v1 prod + v2 prod during the rebuild |
| Neon | Free | **Staging/preview DB** | Keeps the Supabase project count at 2; Postgres-compatible with Drizzle |
| Google AI Studio | Free tier | Gemini API key (separate keys for prod and staging) | |
| Cloudflare R2 | Free (10 GB) | Encrypted nightly backups | Or Google Drive via `rclone` |
| Sentry | Developer (free) | Error tracking (Vercel runtime logs last only 1 h on Hobby) | Optional but recommended |
| UptimeRobot | Free | Ping `/api/health` every 5 min, email/Telegram alert | |

## 2. Environments

| Env | URL | DB | AI | Data |
|---|---|---|---|---|
| Local | `localhost:3000` | Docker Postgres (`docker compose up db`) or `supabase start` | Staging key, budget 20/day | `seed.ts --profile dev` |
| Preview (every PR) | `*-git-*.vercel.app` | Neon `staging` | Staging key, budget 20/day | Seeded fixtures, reset nightly |
| Production | `onluyenvatly.vercel.app` | Supabase v2 | Prod key | Real |

Env vars are managed in the Vercel dashboard per environment and pulled locally with `vercel env pull`. `.env.example` lists every variable with a description and no values.

Connection strings (set 2026-09-28):

| Where | Name | Value |
|---|---|---|
| Vercel · Production | `DATABASE_URL` | Supabase **transaction pooler** `…pooler.supabase.com:6543` |
| Vercel · Preview | `DATABASE_URL` | Neon **pooled** host (`-pooler` in the hostname), the same value as the `NEON_DATABASE_URL_POOLED` secret |
| GitHub Actions | `NEON_DATABASE_URL` | Neon direct (non-pooled) host: staging migrations |
| GitHub Actions | `NEON_DATABASE_URL_POOLED` | Neon pooled host (reference copy) |
| GitHub Actions | `DATABASE_URL_DIRECT` | Supabase **session pooler** `postgres.<ref>@…pooler.supabase.com:5432`: production migrations and backups. Not `db.<ref>.supabase.co`, which is IPv6-only and unreachable from GitHub runners |

## 3. CI/CD
- **Trunk-based.** `main` = production. Short-lived feature branches → PR → CI green + preview checked → squash-merge → Vercel auto-deploys production.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `chore:`) so the changelog is generated.
- **DB migrations:** `drizzle-kit generate` on the dev machine creates SQL files that are committed. `migrate.yml` applies them:
  - to Neon staging automatically on PR merge (before the preview is promoted),
  - to production by a **manual** `workflow_dispatch` with the environment protection rule (owner approval), run **before** merging code that depends on it.
  - Migrations must be backward compatible (expand → deploy → contract), so a rollback of the app never needs a DB rollback.
- **Rollback:** Vercel Instant Rollback to the previous production deployment. Hobby supports rolling back to the immediately previous deployment. Test this once in Sprint 0.
- **Feature flags:** columns in `settings` (e.g. `ai_enabled`, `rating_formula`), toggled in `/admin/settings`.

Workflows:
| File | Trigger | Does |
|---|---|---|
| `ci.yml` | push / PR | lint, typecheck, unit + integration (Postgres service), build, bundle budget, E2E |
| `migrate.yml` | merge to main (staging) / manual (prod) | `drizzle-kit migrate` |
| `backup.yml` | cron `0 19 * * *` (02:00 VN) | `pg_dump` prod → `age`-encrypt → upload to R2; prune to 30 daily + 12 monthly |
| `quota-check.yml` | cron daily 07:00 VN | runs `scripts/check-quotas.ts`: DB size, table sizes, storage bytes, attempts/day, AI calls/day → opens a GitHub issue if any metric is above 60 % of its free limit |
| `restore-drill.yml` | manual, monthly | restores the latest backup into Neon staging and runs `verify-migration.ts`-style sanity checks |

## 4. Scheduled jobs (Vercel Cron, `vercel.json`)
Only daily jobs (a safe choice on Hobby):
```json
{ "crons": [{ "path": "/api/cron/daily", "schedule": "0 20 * * *" }] }
```
`/api/cron/daily` (03:00 VN): expire in-progress attempts past `deadline_at + 1h` (grade with the last saved answers), delete expired sessions and old `rate_limits` rows, prune unused lesson versions and 24-hour-old imports, trim `guard_events`/IPs older than 180 days, and run `select 1` so the Supabase project never counts as inactive.

## 5. Monitoring & alerting
| Signal | Source | Alert |
|---|---|---|
| Site down | UptimeRobot → `/api/health` (checks DB) | Email/Telegram after 2 failures |
| Errors | Sentry (server + client), sample traces at 5 % to stay in the free tier | Email on new issue |
| Web vitals | `useReportWebVitals` → Vercel Analytics (if within the free allowance) or a tiny `/api/vitals` insert with sampling | Weekly review |
| Quotas | Vercel dashboard usage notifications (turn on email alerts) + `quota-check.yml` | GitHub issue at 60 % |
| AI usage | `rate_limits` counters `ai:global:{date}` | In the admin dashboard |
| Backups | `backup.yml` failure → GitHub email | Immediate |

Logging: `src/lib/logger.ts` writes JSON lines (`level`, `msg`, `route`, `userId` hashed, `durationMs`). No personal data in logs (06 §4).

## 6. Runbooks

### DB paused (Supabase inactivity)
Symptom: `/api/health` fails, errors say the project is paused. Fix: Supabase dashboard → Restore project (takes a few minutes). Prevention: check that the cron job and the backup job ran. Look at the Vercel cron logs and the GitHub Actions history.

### Approaching a quota
1. Find the source: Vercel Usage tab (by function/route), Supabase reports.
2. Common fixes: set `prefetch={false}` on the offending links, increase cache life, make autosave less frequent, turn off AI for a day.
3. If a limit will be hit within days: announce "maintenance mode" (the `announcement` banner), and consider one month of Vercel Pro as a paid last resort.

### Gemini unavailable or quota exhausted
Set `ai_enabled = false` in `/admin/settings` if errors are noisy. Cached explanations keep working.

### Bad deploy
Vercel → Deployments → previous → Instant Rollback. Then revert the PR on `main`.

### Student can't log in
Check `/admin/students/[id]`: status (pending?), device binding (reset device), sessions (revoke), reset password (temp password is shown once; send it via Zalo).

### Restore from backup
1. Download the latest `.sql.age` from R2 and decrypt it with the owner's `age` key (the key is kept offline and in a password manager).
2. Restore into a **new** Supabase project or Neon branch first, then verify.
3. Swap `DATABASE_URL` in Vercel and redeploy. Document the data-loss window.

### Cutover and rollback
See 10 §6 and §8.

## 7. Secrets management
- Secrets live only in Vercel env vars and GitHub Actions secrets (backup: `DATABASE_URL_DIRECT`, `R2_*`, `AGE_RECIPIENT`).
- Rotate once a year and whenever a collaborator leaves: DB password, `SESSION_PEPPER` (rotating it logs everyone out, so do it during holidays), Gemini key, `CRON_SECRET`.
- The v1 secrets in `../onluyenvatly/.env` are rotated at v1 decommission (06 §6).
