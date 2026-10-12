# ADR-011: "Học qua video", lessons along a YouTube video

- **Status:** Proposed (owner request 2026-10-12, backlog B-13)
- **Date:** 2026-10-12

## Context
The owner asked for a new kind of lesson: the teacher pastes a YouTube link, the video is embedded, and questions (mcq, tf, short) are attached along it, several at one point and many points along the video. While watching, the video stops at each point for its questions. The first viewing can't skip ahead; after finishing, the student sees the result and seeking unlocks for later viewings (a setting, on by default). Fullscreen is allowed, speeding up is not, leaving the page pauses the video, and a reload resumes where the student was.

Constraints: ADR-004 (no key before submit), the free quotas (docs/08), and that we can't host video ourselves.

## Options
1. **A plain YouTube embed with its controls.** No way to stop skipping or speed changes: YouTube's seek bar, keyboard shortcuts and speed menu are all inside the cross-origin frame.
2. **The YouTube IFrame Player API with our own controls (chosen).** `controls=0`, `disablekb=1`, a transparent shield over the frame after the first play, and our own play/seek/sound/fullscreen bar. The API reports the time and state and holds the speed at 1×.
3. **Self-hosted video.** Storage and egress would blow the free tier; teachers already have their videos on YouTube.

## Decision
Option 2, as a new attempt mode next to the game (ADR-010).
- **Content:** a question's time is part of its content, `Question.at` (seconds), written `[Video 1:23]` in the text format, so it is versioned with the question and attempts keep the times they started with. Questions with the same time are one **cue**; a question without a time is asked when the video ends.
- **Config:** `LessonConfig.video = { youtubeId, seek: "after_first" | "never" | "always", durationSec }`. A video lesson asks every question in video order, so it has no question shuffle, pool, time limit, exam guard or game. `durationSec` is read by the editor's player and saved by `saveVideoDuration`; a time at or past it is asked at the end.
- **Attempt:** mode `video` (migration `0021`) plus `attempts.video` (jsonb `VideoState`: cues `{at, n}`, cues answered, `seek`, the last position and the furthest point). Items are built in video order at start; `seek` is fixed at start (`after_first`: true once the student has a submitted video attempt on the lesson).
- **Rules (pure, `features/video/domain/engine.ts`):** cues are answered in order, once (a repeat reads as answered and can't change the stored answers). Without `seek`, the server checks the wall clock: since the video only plays at 1×, cue `at` can't be answered before `startedAt + at` (5 s slack), the end cue and the finish not before the video's length, and a saved position is cut to what the clock allows. The player applies the same module: the next cue stops the video, a jump beyond the furthest point is undone, the progress bar only seeks within it.
- **Transport:** `POST /api/attempts/[id]/video` with `{progress, pos}`, `{answer, cue, answers}` or `{finish}`. Answers are stored per cue and graded only by the finish (or by the answer to the end cue) through `submitAttempt`, which reads the stored answers for a video attempt like for a game. Nothing about a key comes back before the result page.
- **Privacy:** the player uses `youtube-nocookie.com`. The CSP allows the API script from `www.youtube.com`, frames from `www.youtube-nocookie.com` and thumbnails from `i.ytimg.com`, nothing else.

## Consequences
- **Requests:** one per cue, plus a position save every 20 s while playing and on pause or leaving (a beacon). A 15-minute video is about 50 small primary-key writes per student, below what a test's autosaves cost, and no new query on a page load. Creating a lesson calls YouTube's public oEmbed once for the title (no key, no quota of ours).
- **Anti-skip is best effort.** The shield, our controls and the wall-clock checks stop a student from skipping in the browser; someone scripting requests can still only answer a cue once the clock allows it. The video can't be forced to be watched with attention; leaving the page pauses it.
- **Rewinding is allowed** on the first viewing (only skipping ahead is blocked), as on Edpuzzle: re-watching an explanation helps and can't change locked answers.
- **iPhone:** an element can't go fullscreen there, so the player fills the window instead. The first play may need a tap on YouTube's own button (iOS requires a gesture inside the frame); the shield only appears after it.
- **YouTube changes:** the IFrame API is official and versioned by Google. If a video is removed or made private, the player shows a message and the teacher replaces the link in the settings; attempts already in progress keep their cues.
