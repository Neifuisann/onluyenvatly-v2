# ADR-010: "Bắn zombie", a lesson played as a solo game

- **Status:** Proposed (owner request 2026-10-11, backlog B-11)
- **Date:** 2026-10-11

## Context
The owner asked for a game a teacher can choose in a lesson's settings: each question is a wave of zombies holding the answers, and the student shoots the right one. A wrong shot knocks that zombie out and costs a life; the right one clears the wave at no cost. There are two modes: 1 life or 3. The result must count like a test (score, history, rating per the lesson's settings), and the design should leave room for multiplayer later.

The hard constraint is ADR-004: no key reaches a student before submit. A game has to show, shot by shot, whether a lane was right.

## Options
1. **Ship the keys to the client** and grade at the end. Breaks ADR-004 outright.
2. **A game room (ADR-008) with one player.** Rooms draw from many lessons, have no rating, and their lifecycle (PIN, lobby, cron) is heavy for a solo lesson.
3. **A new attempt mode graded per shot (chosen).** The lesson stays a lesson; its attempt runs as a game.

## Decision
Option 3.
- **Config:** `LessonConfig.game = { kind: "zombie", lives: 1 | 3, secondsPerQuestion }` (null = a normal test). A game requires `revealAnswers: "after_submit"`, no `startsAt`, no overall time limit and no exam guard, since every wave shows its key once it ends. That is the same rule `lessonAllowsPractice`/`lessonAllowsGame` apply.
- **Attempt:** mode `game` (migration `0018`) plus `attempts.game` (jsonb `ZombieState`). Only mcq and tf questions are played. Each mcq is one wave (one lane per option, shuffled per attempt as usual); each tf statement is one wave with two lanes (Đúng, Sai). Short answers are left out at start, and the settings say how many.
- **Rules (pure, `features/zombie/domain/engine.ts`):** the right lane ends the wave. A wrong lane costs a life, and the wave ends when only one lane is left. A zombie reaching the barricade (the server's clock ran out) costs a life and ends the wave. No lives left ends the game. **The first shot of a wave is its answer**, written into `attempts.answers`, so the normal `grade()` scores the attempt, and the result page, rating and mistakes bank work unchanged.
- **Transport:** `POST /api/attempts/[id]/game` with `{begin}`, `{shoot, wave, lane}` or `{timeout, wave}`. One transaction locks the row per move; a retried or doubled move comes back `stale`. A wave's key is stored and returned only once that wave has ended. The move that ends the game grades the attempt (`submitAttempt`, which reads the stored answers for a game). Should that fail, the runner page grades it on the next visit.
- **Clock:** the server stores when the current wave's clock starts (`at`: start + 3 s countdown, or the previous wave's end + 1.8 s). A shot arriving after the clock plus 1.5 s grace counts as a timeout. A timeout may arrive at most 1 s early.
- **Not rate limited per move:** the rules bound a game's moves (one hit per wave, at most `lives` misses, a break between waves), and starts are already limited.
- **Autosave** refuses game attempts (`mode <> 'game'` in its guarded UPDATE). Practice checks refuse them too.

## Consequences
- **Requests:** one per shot or timeout. A 20-question game is about 25–30 requests, about what a test's autosaves cost. No polling.
- **Art:** the client draws placeholder SVG art. Generated images replace it by name via `features/zombie/assets.ts` (prompts in `docs/games/zombie-art-prompts.md`).
- **Phones:** the game needs landscape. Phones held upright see a rotate prompt (CSS only); "Bắt đầu" asks Android for fullscreen and a landscape lock.
- **Multiplayer later:** the engine knows nothing of storage or transport. A room variant can run one `ZombieState` per player on `game_players` and reuse ADR-008's polling for the standings.
- **Leaving mid-game:** with a clock, the zombies keep walking. Coming back after a wave's time ran out costs that wave's life at once. There is no pause, because a pause would let a student read a question without the clock running.
