"use client";

import { clsx } from "clsx";
import { Music, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { formatClock, formatDateTime } from "@/lib/dates";
import { gameCopy } from "../../messages";
import type { RoomState } from "../../types";
import { useLobbyMusic } from "../lobby-music";
import { RacerChip } from "../racer";
import { StageBar, StageMessage } from "../stage";
import { useCountdown } from "../use-countdown";
import { useRoomPoll } from "../use-room-poll";
import { JoinForm } from "./join-form";

const t = gameCopy.play;

/** Beeps for the last seconds of a scheduled countdown. */
const BEEP_FROM = 5;

/**
 * Waiting for the teacher: who's here, polled every 2 s (ADR-008), with
 * music. A scheduled room (B-15) counts down to its start and polls the
 * moment it comes, which starts the room for everyone waiting.
 */
export function Lobby({
  roomId,
  title,
  initial,
}: {
  roomId: string;
  title: string;
  initial: RoomState;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const { state, problem, pollNow } = useRoomPoll(roomId, {
    intervalMs: 2000,
    initial,
  });
  const room = state ?? initial;
  const me = room.players.find((p) => p.id === room.meId);
  const left = useCountdown(room.scheduledAt, room.serverNow);
  const music = useLobbyMusic(room.status === "lobby");

  useEffect(() => {
    if (room.status !== "lobby") router.refresh();
  }, [room.status, router]);

  // The last seconds beep; at zero the next poll starts the room.
  const lastLeft = useRef(left);
  useEffect(() => {
    if (left === lastLeft.current) return;
    lastLeft.current = left;
    if (left === null) return;
    if (left === 0) pollNow();
    else if (left <= BEEP_FROM) music.beep(false);
  }, [left, pollNow, music.beep]);

  if (problem === "removed")
    return <StageMessage pose="sleeping" title={t.removed} />;

  return (
    <div className="flex min-h-dvh flex-col">
      <StageBar title={title}>
        <button
          type="button"
          onClick={music.toggle}
          aria-pressed={music.on}
          className={buttonVariants({ variant: "stage", size: "sm" })}
        >
          {music.on ? <Music aria-hidden /> : <VolumeX aria-hidden />}
          {music.on ? t.musicOff : t.musicOn}
        </button>
      </StageBar>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-6 px-4 pt-4 pb-12">
        {editing && me ? (
          <JoinForm
            roomId={roomId}
            initial={me}
            submitLabel={t.save}
            onDone={() => {
              setEditing(false);
              pollNow();
            }}
          />
        ) : (
          <>
            <section className="flex animate-pop flex-col items-center gap-3 text-center">
              {me && (
                <RacerChip
                  racer={me.racer}
                  color={me.color}
                  size="xl"
                  className="animate-bob"
                />
              )}
              <h1 className="font-bold font-display text-3xl">
                {t.lobbyTitle}
              </h1>
              <p className="font-semibold text-lg">{me?.name}</p>
              {room.scheduledAt && left !== null && (
                <div className="w-full rounded-2xl bg-lane px-4 py-3">
                  <p className="text-ink-muted text-sm">
                    {left > 0 ? t.startsIn : t.startingNow}
                  </p>
                  <p
                    className="num font-bold font-display text-5xl text-accent tabular-nums"
                    aria-live={left <= BEEP_FROM ? "assertive" : "off"}
                  >
                    {formatClock(left)}
                  </p>
                </div>
              )}
              <output className="flex items-center gap-2 text-ink-muted">
                <span
                  aria-hidden
                  className="size-2 animate-pulse rounded-full bg-accent"
                />
                {problem === "offline"
                  ? gameCopy.host.connection
                  : room.scheduledAt
                    ? t.startsAt(formatDateTime(new Date(room.scheduledAt)))
                    : t.lobbyWait}
              </output>
              {room.zombie ? (
                <ul className="space-y-1 text-ink-muted text-sm">
                  <li>
                    {t.rulesZombie(
                      room.settings.lives ?? 0,
                      room.zombie.seconds,
                    )}
                  </li>
                  {room.settings.sameQuestion && <li>{t.rulesSameQuestion}</li>}
                </ul>
              ) : (
                (room.settings.sameQuestion ||
                  room.settings.lives !== null) && (
                  <ul className="space-y-1 text-ink-muted text-sm">
                    {room.settings.sameQuestion && (
                      <li>{t.rulesSameQuestion}</li>
                    )}
                    {room.settings.lives !== null && (
                      <li>{t.rulesLives(room.settings.lives)}</li>
                    )}
                  </ul>
                )
              )}
              <button
                type="button"
                onClick={() => setEditing(true)}
                className={buttonVariants({ variant: "stage", size: "sm" })}
              >
                {t.change}
              </button>
            </section>
            <section className="w-full" aria-labelledby="lobby-players">
              <h2
                id="lobby-players"
                className="mb-3 text-center font-semibold text-ink-muted text-sm"
              >
                {t.lobbyPlayers(room.players.length)}
              </h2>
              <ul className="flex flex-wrap justify-center gap-2">
                {room.players.map((p) => (
                  <li
                    key={p.id}
                    className={clsx(
                      "flex max-w-full animate-pop items-center gap-2 rounded-full bg-lane py-1 pr-3.5 pl-1 text-sm",
                      p.id === room.meId && "ring-2 ring-accent",
                    )}
                  >
                    <RacerChip racer={p.racer} color={p.color} size="sm" />
                    <span className="truncate">{p.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
