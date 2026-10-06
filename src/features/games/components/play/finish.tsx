"use client";

import { Flag } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { gameCopy } from "../../messages";
import type { RoomState } from "../../types";
import { Confetti, Podium } from "../podium";
import { RaceTrack } from "../race-track";
import { RacerChip } from "../racer";
import { StageBar, StageMessage } from "../stage";
import { useRoomPoll } from "../use-room-poll";

const t = gameCopy.play;

/** Lanes shown at the finish line before the full list is needed. */
const LANES = 10;

/**
 * Past the finish line (B-05): while others still race, the live board
 * (polled every 3 s); once the race is over, the podium and my result.
 */
export function Finish({
  roomId,
  title,
  initial,
}: {
  roomId: string;
  title: string;
  initial: RoomState;
}) {
  const { state, problem } = useRoomPoll(roomId, {
    intervalMs: 3000,
    initial,
    enabled: initial.status !== "finished",
  });
  const room = state ?? initial;
  const over = room.status === "finished";
  const me = room.players.find((p) => p.id === room.meId) ?? null;

  if (problem === "removed")
    return <StageMessage pose="sleeping" title={t.removed} />;

  const lanes = room.players.slice(0, LANES);
  if (me && !lanes.includes(me)) lanes.push(me);

  return (
    <div className="flex min-h-dvh flex-col">
      {over && <Confetti />}
      <StageBar title={title} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 pt-2 pb-12">
        <section className="flex animate-pop flex-col items-center gap-2 text-center">
          {over ? (
            <h1 className="font-bold font-display text-3xl">{t.finalTitle}</h1>
          ) : (
            <>
              <Flag aria-hidden className="size-10 fill-accent text-accent" />
              <h1 className="font-bold font-display text-4xl">
                {t.finishTitle}
              </h1>
              <output className="block text-ink-muted">
                {problem === "offline"
                  ? gameCopy.host.connection
                  : t.finishWait}
              </output>
            </>
          )}
        </section>

        {over && (
          <Podium
            players={room.players}
            meId={room.meId}
            label={gameCopy.host.podium}
          />
        )}

        {me && (
          <section
            aria-label={t.you}
            className="flex items-center gap-4 rounded-xl bg-lane p-4"
          >
            <RacerChip racer={me.racer} color={me.color} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="num font-bold font-display text-2xl text-accent">
                {t.finalRank(me.rank)}
                <span className="font-normal text-base text-ink-muted">
                  {" "}
                  / {room.players.length}
                </span>
              </p>
              <p className="num font-semibold">{t.points(me.score)}</p>
              <p className="num text-ink-muted text-sm">
                {t.correctOf(me.correct, room.questionCount)}
                {me.bestStreak >= 2 && `. ${t.bestStreak(me.bestStreak)}`}
              </p>
            </div>
          </section>
        )}

        <section aria-labelledby="finish-board" className="space-y-3">
          <h2
            id="finish-board"
            className="font-semibold text-ink-muted text-sm"
          >
            {gameCopy.host.leaderboard}
          </h2>
          <RaceTrack
            players={lanes}
            questionCount={room.questionCount}
            meId={room.meId}
            label={gameCopy.host.leaderboard}
          />
        </section>

        {over && (
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/play"
              prefetch={false}
              className={buttonVariants({ variant: "accent", size: "lg" })}
            >
              {t.another}
            </Link>
            <Link
              href="/dashboard"
              prefetch={false}
              className={buttonVariants({ variant: "ink", size: "lg" })}
            >
              {t.toDashboard}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
