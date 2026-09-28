# 14 — Coding Conventions

These rules keep the codebase small, fast and within quota. They apply to humans and AI coding agents alike. `AGENTS.md`/`CLAUDE.md` at the repo root links here.

## 1. Layering
```
app/ (routes: thin)  →  features/<x>/queries.ts   (server-only reads, cached or per-request)
                     →  features/<x>/actions.ts   ("use server" mutations)
                     →  features/<x>/service.ts   (orchestration, DB transactions)
                     →  features/<x>/domain/*.ts  (PURE logic: no db, no next, no fetch)
components/          →  presentational; no DB access
db/                  →  schema + client only
lib/                 →  cross-cutting helpers (env, cache tags, rate limit, dates, logger, messages)
```
- **Pure domain functions** hold all business rules: grading, rating, parsing, pool selection, points distribution, number normalization. They take plain data and return plain data. That's why they're easy to unit-test and portable (see the ADR-001 exit plan).
- `import 'server-only'` at the top of every `queries.ts`, `service.ts`, `db/*` and any module that reads secrets.
- Pages never call `db` directly; they go through `queries.ts`.

## 2. Server Actions & route handlers
Every action follows this template:
```ts
'use server';
export async function submitSomething(input: unknown): Promise<Result<Output>> {
  const user = await requireStudent();                 // 1. authn/authz — first line, always
  const data = SomethingSchema.parse(input);           // 2. validate (Zod)
  await rateLimit(`something:${user.id}`, 10, '1m');   // 3. rate limit when abusable
  const out = await somethingService(user, data);      // 4. work (transaction inside the service)
  revalidateTag(tags.something(out.id));               // 5. precise invalidation
  return ok(out);                                      // 6. typed result, never throw to the client
}
```
- Map expected failures to `err('CODE')`. Let unexpected errors bubble to the error boundary and Sentry.
- Mutating route handlers call `assertSameOrigin(req)` and a guard.

## 3. Data access
- Drizzle query builder by default; `sql` template only for things like trigram search or window functions, **always parameterized**.
- Any flow with more than one write uses `db.transaction`.
- Select only the columns you need. **Never select `lesson_versions.questions` in student-facing queries** except through `getLessonForTaking` (stripped) or grading.
- Every new query on a large table (`attempts`, `mistakes`) needs an index that supports it. Put the `EXPLAIN` in the PR description.
- Timestamps are `timestamptz`, stored in UTC and formatted in `Asia/Ho_Chi_Minh` via `lib/dates.ts`.

## 4. Caching
- Shared data uses explicit `"use cache"`, `cacheTag` and `cacheLife` inside server-only query functions, matching the installed Next.js 16 Cache Components API. Tag names come only from `lib/cache-tags.ts`. The proposed runtime `cached(fn, ...)` wrapper was not introduced: the directive is a compiler boundary.
- Per-user data is never shared-cached. Use `React.cache` for per-request dedupe.
- Every mutation lists which tags it invalidates. The reviewer checks for missing invalidation.

## 5. Components & styling
- Server Components by default. Add `'use client'` only for interactivity, and push it as far down the tree as possible.
- Tailwind utility classes with design tokens only. No raw hex colors outside `globals.css`. Use `cn()` for conditional classes.
- shadcn components live in `components/ui` and may be edited. App components live in `components/` or `features/<x>/components/`.
- Heavy client libraries (Recharts, CodeMirror, mammoth UI) go through `next/dynamic`.
- Every data view has **loading (skeleton), empty and error** states.
- Accessibility: labelled inputs, `button` for actions and `a`/`Link` for navigation, visible focus rings, `aria-live` for timer and save state.

## 6. Naming & files
- Files `kebab-case.ts(x)`; components `PascalCase`; functions `camelCase`; DB `snake_case`.
- Code identifiers in English. UI strings in Vietnamese in `lib/messages.ts` (or colocated `messages.ts` per feature).
- Tests sit next to the code: `grade.ts` + `grade.test.ts`. E2E tests go in `tests/e2e/*.spec.ts`.

## 7. TypeScript
- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- No `any`. Use `unknown` plus Zod at boundaries.
- Infer types from Zod (`z.infer`) and Drizzle (`typeof table.$inferSelect`); don't duplicate them by hand.

## 8. Git & PRs
- Branch `feat/S3-04-submit`, Conventional Commit titles, squash merge.
- PR template: what/why, task ID, screenshots (mobile + desktop), tests added, cache tags touched, migration (yes/no), quota impact (yes/no).
- Keep PRs under ~400 changed lines where possible.

## 9. Review checklist
- [ ] Guard on the first line of every action/handler
- [ ] Zod validation at every boundary
- [ ] No answers or explanations reachable by students before submit
- [ ] Transactions for multi-write flows; idempotency where a client may retry
- [ ] Cache tags invalidated; no per-user data in shared cache
- [ ] No new per-request DB query on a hot path without a reason
- [ ] `prefetch={false}` on long link lists
- [ ] Loading/empty/error states; mobile 360 px checked
- [ ] No personal data or secrets in logs
- [ ] Docs updated
