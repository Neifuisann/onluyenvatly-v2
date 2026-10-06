"use client";

import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { gameCopy } from "../../messages";
import type { RoomState } from "../../types";
import { RacerChip } from "../racer";
import { StageBar, StageMessage } from "../stage";
import { useRoomPoll } from "../use-room-poll";
import { JoinForm } from "./join-form";

const t = gameCopy.play;

/** Waiting for the teacher: who's here, polled every 2 s (ADR-008). */
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

  useEffect(() => {
    if (room.status !== "lobby") router.refresh();
  }, [room.status, router]);

  if (problem === "removed")
    return <StageMessage pose="sleeping" title={t.removed} />;

  return (
    <div className="flex min-h-dvh flex-col">
      <StageBar title={title} />
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
              <output className="flex items-center gap-2 text-ink-muted">
                <span
                  aria-hidden
                  className="size-2 animate-pulse rounded-full bg-accent"
                />
                {problem === "offline" ? gameCopy.host.connection : t.lobbyWait}
              </output>
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
