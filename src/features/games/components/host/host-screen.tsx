"use client";

import { Check, Copy, Flag, Play, RotateCcw, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  endGameAction,
  removePlayerAction,
  replayGameAction,
  startGameAction,
} from "../../admin-actions";
import type { Standing } from "../../domain/standings";
import { gameCopy } from "../../messages";
import type { RoomState } from "../../types";
import { Confetti, Podium } from "../podium";
import { RaceTrack } from "../race-track";
import { RacerChip } from "../racer";
import { StageBar } from "../stage";
import { useRoomPoll } from "../use-room-poll";

const t = gameCopy.host;

/**
 * The teacher's projector (B-05): the PIN, link and QR in the lobby, the
 * whole class on the track during the race, the podium and the hardest
 * questions at the end. Polls every 2 s while the room is open (ADR-008).
 */
export function HostScreen({
  roomId,
  title,
  pin,
  joinUrl,
  joinHost,
  qr,
  settings,
  initial,
  report,
}: {
  roomId: string;
  title: string;
  pin: string;
  joinUrl: string;
  /** The link without the scheme, as people type it. */
  joinHost: string;
  qr: ReactNode;
  settings: string;
  initial: RoomState;
  /** Server-rendered once the race is over. */
  report: ReactNode;
}) {
  const router = useRouter();
  const { state, problem, pollNow } = useRoomPoll(roomId, {
    intervalMs: 2000,
    initial,
    enabled: initial.status !== "finished",
  });
  const room = state ?? initial;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [removing, setRemoving] = useState<Standing | null>(null);

  // The report is rendered on the server: fetch the page once it's over.
  useEffect(() => {
    if (room.status === "finished" && initial.status !== "finished")
      router.refresh();
  }, [room.status, initial.status, router]);

  const run = (action: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) setError(result.message ?? null);
      pollNow();
    });

  const done = room.players.filter((p) => p.finished).length;

  return (
    <div className="flex min-h-dvh flex-col">
      {room.status === "finished" && <Confetti />}
      <StageBar title={title} className="border-lane border-b">
        {room.status !== "lobby" && (
          <span className="num hidden rounded-full bg-lane px-3 py-1 font-bold font-display sm:inline">
            {t.pinLabel} {pin}
          </span>
        )}
        {room.status === "lobby" && (
          <Button
            size="lg"
            disabled={pending || room.players.length === 0}
            onClick={() => run(() => startGameAction(roomId))}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Play aria-hidden className="fill-current" />
            {pending ? t.starting : t.start}
          </Button>
        )}
        {room.status === "running" && (
          <Button variant="ink" onClick={() => setConfirmEnd(true)}>
            <Flag aria-hidden />
            {t.end}
          </Button>
        )}
      </StageBar>

      {(error || problem === "offline") && (
        <p
          role="alert"
          className="bg-danger px-4 py-2 text-center text-danger-foreground text-sm"
        >
          {error ?? t.connection}
        </p>
      )}

      {room.status === "lobby" && (
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-6 sm:px-8 sm:py-10">
          <section className="grid animate-rise items-center gap-6 rounded-2xl bg-lane p-6 sm:p-8 lg:grid-cols-[1fr_auto]">
            <div className="min-w-0 space-y-4">
              <p className="text-ink-muted text-lg sm:text-xl">
                {t.joinAt}{" "}
                <strong className="font-semibold text-ink-foreground">
                  {joinHost}
                </strong>
              </p>
              <div>
                <p className="text-ink-muted">{t.pinLabel}</p>
                <p className="num font-bold font-display text-7xl text-accent tracking-wider sm:text-8xl lg:text-9xl">
                  {pin.slice(0, 3)}
                  <span className="ml-[0.2em]">{pin.slice(3)}</span>
                </p>
              </div>
              <CopyLink url={joinUrl} />
              <p className="text-ink-muted text-sm">{settings}</p>
            </div>
            <div className="mx-auto w-48 rounded-xl bg-ink-foreground p-3 text-ink sm:w-60 lg:w-72">
              {qr}
            </div>
          </section>

          <section aria-labelledby="host-players" className="space-y-4">
            <h2
              id="host-players"
              className="flex items-center gap-2 font-display font-semibold text-xl"
            >
              <Users aria-hidden className="size-5" />
              <span className="num">{t.playerCount(room.players.length)}</span>
            </h2>
            {room.players.length === 0 ? (
              <p className="flex items-center gap-3 text-ink-muted text-lg">
                <span
                  aria-hidden
                  className="size-2.5 animate-pulse rounded-full bg-accent"
                />
                {t.waiting}
              </p>
            ) : (
              <ul className="flex flex-wrap gap-3">
                {room.players.map((p) => (
                  <li key={p.id} className="animate-pop">
                    <button
                      type="button"
                      onClick={() => setRemoving(p)}
                      aria-label={t.remove(p.name)}
                      className="group flex items-center gap-2.5 rounded-full bg-lane py-1.5 pr-4 pl-1.5 text-lg transition-colors hover:bg-danger hover:text-danger-foreground"
                    >
                      <RacerChip racer={p.racer} color={p.color} size="md" />
                      <span className="max-w-48 truncate font-semibold">
                        {p.name}
                      </span>
                      <X
                        aria-hidden
                        className="size-4 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      )}

      {room.status === "running" && (
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 sm:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="font-bold font-display text-2xl">{t.track}</h1>
            <p className="num text-ink-muted text-lg" role="status">
              {t.finishedCount(done, room.players.length)}
            </p>
          </div>
          <RaceTrack
            players={room.players}
            questionCount={room.questionCount}
            size="stage"
            label={t.leaderboard}
          />
        </main>
      )}

      {room.status === "finished" && (
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-8 sm:px-8">
          <section aria-labelledby="host-podium" className="space-y-6">
            <h1
              id="host-podium"
              className="text-center font-bold font-display text-3xl sm:text-4xl"
            >
              {t.podium}
            </h1>
            {room.players.length > 0 ? (
              <Podium players={room.players} label={t.podium} />
            ) : (
              <p className="text-center text-ink-muted">{t.nobody}</p>
            )}
          </section>
          {room.players.length > 3 && (
            <section aria-labelledby="host-board" className="space-y-4">
              <h2
                id="host-board"
                className="font-display font-semibold text-xl"
              >
                {t.leaderboard}
              </h2>
              <RaceTrack
                players={room.players}
                questionCount={room.questionCount}
                size="stage"
                label={t.leaderboard}
              />
            </section>
          )}
          {report}
          <div className="flex flex-wrap justify-center gap-3 pb-6">
            <Button
              size="lg"
              disabled={pending}
              onClick={() => run(() => replayGameAction(roomId))}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <RotateCcw aria-hidden />
              {pending ? t.replaying : t.replay}
            </Button>
            <Link
              href="/admin/games"
              prefetch={false}
              className={buttonVariants({ variant: "ink", size: "lg" })}
            >
              {t.backToList}
            </Link>
          </div>
        </main>
      )}

      <Dialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title={t.endConfirm}
        closeLabel={t.cancel}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmEnd(false)}>
              {t.cancel}
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => {
                setConfirmEnd(false);
                run(() => endGameAction(roomId));
              }}
            >
              {pending ? t.ending : t.end}
            </Button>
          </>
        }
      >
        <p>{t.finishedCount(done, room.players.length)}</p>
      </Dialog>
      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={removing ? t.remove(removing.name) : ""}
        closeLabel={t.cancel}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              {t.cancel}
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => {
                const p = removing;
                setRemoving(null);
                if (p)
                  run(() => removePlayerAction({ roomId, playerId: p.id }));
              }}
            >
              {t.removeAction}
            </Button>
          </>
        }
      >
        <p>{removing && t.removeConfirm(removing.name)}</p>
      </Dialog>
    </div>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ink"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
      className={cn(copied && "bg-success text-success-foreground")}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      <span aria-live="polite">{copied ? t.copied : t.copyLink}</span>
    </Button>
  );
}
