# ADR-003: Custom database-session auth (phone + password), roles in DB

- **Status:** Accepted (owner, 2026-09-28)
- **Date:** 2026-09-28

## Context
Requirements: login by **phone number and password** (no SMS, no email); **teacher approval** before first login; optional **single active session** (device binding was dropped by the owner on 2026-09-28); existing **bcrypt** hashes must keep working; multiple admins; $0.

## Options
| Option | Verdict |
|---|---|
| Supabase Auth | Phone login requires an SMS provider (costs money). Faking emails like `0912…@students.local` works but fights the product. Approval and device rules would still be custom. Adds JWT refresh complexity in RSC. **Rejected** |
| Auth.js (NextAuth) Credentials | The credentials provider is deliberately limited (JWT only by default, no DB sessions for credentials), so device and session rules would be bolted on. **Rejected** |
| Better Auth (username/phone plugins) | Good library. But our rules (approval, device binding, one session, legacy bcrypt) need custom hooks anyway, and it adds a dependency and its own tables. **Viable alternative** |
| **Custom, ~300 lines, following the Lucia/"Copenhagen Book" session pattern** | Full control, tiny, easy to test. **Chosen** |

## Decision
- `sessions` table: `id` = SHA-256(token + pepper), `user_id`, `expires_at`, `ip`, `user_agent`, `created_at`, `last_seen_at`.
- Cookie `ovl_session` = random 32-byte token (base64url), `HttpOnly; Secure; SameSite=Lax; Path=/`, **30-day sliding expiry**. The session is extended when fewer than 15 days remain, so we don't write to the DB on every request.
- No device binding and no device cookie. v1's fingerprinting (`fp.min.js`, `device-id.js`) is removed.
- Password hashing: **bcryptjs, cost 10** for compatibility with v1 `$2b$10$` hashes. It's pure JS, so there's no native build issue on Vercel.
- `getCurrentUser()` is wrapped in React `cache()`, so it does at most one DB lookup per request (join `sessions` → `users`).
- Roles are `student` or `admin` in `users.role`. Admins are rows in the same table. The hard-coded admin is removed and the first admin is created by `scripts/seed.ts`.
- Authorization lives in **layouts and every server action/route handler** (`requireStudent()`, `requireAdmin()`), never only in `proxy.ts`/middleware.

## Consequences
- We own security-sensitive code, so it needs unit tests and the checklist in 06.
- Session revocation is immediate (delete rows), which makes "logout all devices" and single-session enforcement easy.
- No third-party auth quota.
