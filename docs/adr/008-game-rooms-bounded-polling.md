# ADR-008: Live game rooms with bounded polling, not a realtime service

- **Status:** Proposed (needs the owner's sign-off; it reverses 01 §7 Q4)
- **Date:** 2026-10-06

## Context
The owner asked for a Kahoot/Quizizz/Blooket-style game (backlog B-05): a teacher opens a room, students join with a link or PIN, answer a random bank of questions drawn from chosen lessons, and race on live points and rankings. v1's quiz game was dropped in Sprint 0 because nobody used it (01 §7 Q4, 08 §3). This request reverses that decision for a new, class-led format.

A live room needs every phone and the projector to learn about joins, the start, and the standings. The architecture rules out the usual tools: no Realtime, no Redis, no extra service (02 §8), and "no polling anywhere" (08 §4.3). Every request counts against the Vercel Hobby and Supabase Free budgets (08 §3).

## Options
1. **Supabase Realtime (broadcast/presence).** True push. It adds a client SDK, channel auth and a quota (200 concurrent connections and 2M messages on Free), and reverses the "no Realtime" decision in 02 §8.
2. **Server-Sent Events from a route handler.** Still needs a source of changes (a DB poll inside the handler, since instances share nothing). A function stays open per phone for the whole game, which costs provisioned memory (GB-hours) for every connected student.
3. **Teacher-paced, Kahoot-style rounds.** Every phone must learn when each question opens, so all phones poll fast during the whole game.
4. **Student-paced race with bounded polling (chosen).** Quizizz-style: each student answers at their own pace against server-measured timers. Every answer is a request anyway, so its response carries the standings. Only screens with nothing to send poll: the lobby, the projector, and players who have finished.

## Decision
Option 4.
- **Pacing:** players race through the same bank at their own speed. Order and mcq options are shuffled per player from a stored seed. The server times each question from moments it can compute itself (race start or join plus a 4 s countdown, then the previous answer plus 3 s of feedback). Speed points run 1000 → 500 over the question's time, plus up to +100 for a streak. A key is shown only after its question is answered. Lessons whose answers are still hidden (`lessonAllowsGame`) can't feed a race, so ADR-004 holds.
- **Transport:** JSON route handlers, not Server Actions, because React runs a page's actions one at a time and a poll must never delay an answer.
  - `POST /api/games/[id]/answer`: grades, scores and returns the key, the new score and the standings.
  - `GET /api/games/[id]/state?rev=N`: returns **204 with no body** when the room's `rev` hasn't changed.
  - Every change players can see bumps `game_rooms.rev`.
- **Polling bounds:**
  - Lobby: every 2 s.
  - Projector: every 2 s.
  - Finished players: every 3 s.
  - Nobody polls during the race itself.
  - Polls stop when the tab is hidden and back off to 10 s on errors.
  - Polling stops for good once the room is finished, so a podium left on screen costs nothing.
  - After 5 minutes without a change, polls slow to every 10 s. That bounds a projector left open in the lobby until the cron closes it.
- **Shared reads:** a room's state is memoized per function instance for 1 s, so a class polling together reads the room about once per second.
- **Correctness under concurrency:**
  - An answer writes with `WHERE answered = i`, so a retried or parallel copy counts once.
  - The room row is locked first, which refuses answers after the host ends the race. It also lets the last two finishers close the room without missing each other.
- **Lifecycle:**
  - A room runs no longer than its hard end: every question at full time plus 5 minutes.
  - The daily cron closes abandoned lobbies and races, and deletes rooms after 30 days.
  - Lesson versions a room uses are kept on publish and by the cron.
- **Out of scope:** games don't move the rating or the mistakes bank, and there are no anonymous players (logged-in students only).

## Consequences
- **Quota estimate.** Assume one game is 40 players, 20 questions, a 3-minute lobby, and players waiting about 1 minute at the finish. That is about 3,600 lobby polls, 800 answers, 150 projector polls, 800 finish polls and 160 page loads: **≈ 5,600 invocations per game**.
  - At three games a week (≈ 13 a month), that is ≈ 73k invocations, about **7 % of the 1M budget**.
  - Most polls are 204s at ~10 ms of CPU, so ≈ 15 min of Active CPU a month (≈ 6 % of 4 h).
  - Origin transfer is ≈ 60 MB a month. DB growth is ≈ 500 player rows a month, kept 30 days.
  - These numbers go into 08 §3 and the daily quota check. If games become daily, revisit them.
- 08 §4.3 now reads "no polling outside live game rooms". The rule stands everywhere else.
- Standings on a phone can be up to ~1 s old (the memo), and the projector up to ~3 s. Fine for a race; not fine for a buzzer, which is one reason teacher-paced rounds (option 3) were not chosen.
- Moving to option 1 later is contained: the poll hook (`use-room-poll.ts`) and the `rev` contract are the only places that would change.
