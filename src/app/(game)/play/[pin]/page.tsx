import type { Metadata } from "next";
import { toRunnerQuestion } from "@/features/attempts/components/runner/to-runner-question";
import { requireStudent } from "@/features/auth/guards";
import { PlayScreen } from "@/features/games/components/play/play-screen";
import type { RaceQuestion } from "@/features/games/components/play/race";
import { RacerChip } from "@/features/games/components/racer";
import { StageBar, StageMessage } from "@/features/games/components/stage";
import {
  bankPublicQuestions,
  remainingQuestions,
} from "@/features/games/content";
import { defaultRacer } from "@/features/games/domain/rules";
import {
  effectiveStatus,
  limitMs,
  questionShownAt,
} from "@/features/games/domain/scoring";
import { playerView } from "@/features/games/domain/standings";
import { gameCopy } from "@/features/games/messages";
import {
  getPlayer,
  getRoomBank,
  getRoomByPin,
  getRoomSnapshot,
} from "@/features/games/queries";
import { PinSchema } from "@/features/games/schemas";
import { notePinMiss, roomState } from "@/features/games/service";

const t = gameCopy.play;

/** Live and per user, opened from a link or a QR scan: blocking is expected. */
export const instant = false;

export const metadata: Metadata = {
  title: t.pageTitle,
  robots: { index: false, follow: false },
};

/**
 * `/play/[pin]` (B-05): the student's whole game on one URL, the link the
 * teacher shares. Not joined → pick a racer; lobby → wait; running → race;
 * past the line or over → the finish. Client screens call `router.refresh()`
 * when the phase changes, and this page renders the next one.
 */
export default async function PlayPage({ params }: PageProps<"/play/[pin]">) {
  const user = await requireStudent();
  const pin = PinSchema.safeParse((await params).pin);
  const room = pin.success ? await getRoomByPin(pin.data) : null;
  if (!room) {
    const allowed = await notePinMiss(user.id);
    return (
      <StageMessage
        pose="telescope"
        title={allowed ? t.notFound : t.tooManyMisses}
        action={{ href: "/play", label: t.enter }}
      />
    );
  }

  const now = new Date();
  const status = effectiveStatus(room, now);
  const player = await getPlayer(room.id, user.id);
  if (player?.removedAt)
    return <StageMessage pose="sleeping" title={t.removed} />;

  if (!player) {
    if (status === "finished")
      return (
        <StageMessage
          pose="sleeping"
          title={t.finishedTitle}
          body={t.finishedBody}
        />
      );
    const snapshot = await getRoomSnapshot(room.id, now.getTime());
    const others = snapshot?.players ?? [];
    return (
      <div className="flex min-h-dvh flex-col">
        <StageBar title={room.title} />
        <main className="mx-auto flex w-full max-w-md flex-1 animate-rise flex-col gap-6 px-4 pt-2 pb-12">
          <div className="space-y-1 text-center">
            <h1 className="font-bold font-display text-3xl">{t.joinTitle}</h1>
            <p className="text-ink-muted">
              {status === "running" ? t.running : t.joinLead(room.title)}
            </p>
          </div>
          {others.length > 0 && (
            <div className="flex items-center justify-center gap-2 text-ink-muted text-sm">
              <span aria-hidden className="flex -space-x-2">
                {others.slice(0, 5).map((p) => (
                  <RacerChip
                    key={p.id}
                    racer={p.racer}
                    color={p.color}
                    size="sm"
                    outline="ink"
                  />
                ))}
              </span>
              {t.lobbyPlayers(others.length)}
            </div>
          )}
          <PlayScreen
            phase="join"
            roomId={room.id}
            initial={defaultRacer(user.id)}
          />
        </main>
      </div>
    );
  }

  const snapshot = await getRoomSnapshot(room.id, now.getTime());
  const state = roomState(room, snapshot?.players ?? [], player.id, now);

  if (status === "lobby")
    return (
      <PlayScreen
        phase="lobby"
        roomId={room.id}
        title={room.title}
        initial={state}
      />
    );

  if (status === "finished" || player.finishedAt || !room.startedAt)
    return (
      <PlayScreen
        phase="finish"
        roomId={room.id}
        title={room.title}
        initial={state}
      />
    );

  const bank = await getRoomBank(room.id);
  const publicQuestions = bank && (await bankPublicQuestions(bank));
  if (!publicQuestions)
    return <StageMessage pose="broken" title={gameCopy.create.errorTitle} />;
  const remaining = remainingQuestions(
    publicQuestions,
    player.seed,
    player.answered,
  );
  const questions: RaceQuestion[] = remaining.map((q) => {
    const { type, stem, options, statements } = toRunnerQuestion(q, 1);
    return {
      type,
      limitMs: limitMs(type, room.pace),
      stem,
      ...(options && { options }),
      ...(statements && { statements }),
    };
  });
  return (
    <PlayScreen
      phase="race"
      // A refresh after a resync starts again from the server's position.
      key={`${room.id}:${player.answered}`}
      roomId={room.id}
      title={room.title}
      questions={questions}
      startIndex={player.answered}
      total={publicQuestions.length}
      shownAt={questionShownAt({
        raceStartedAt: room.startedAt,
        joinedAt: player.joinedAt,
        lastAnsweredAt: player.lastAnsweredAt,
      }).toISOString()}
      serverNow={now.toISOString()}
      initialScore={player.score}
      initialStreak={player.streak}
      initialView={playerView(state.players, player.id)}
    />
  );
}
