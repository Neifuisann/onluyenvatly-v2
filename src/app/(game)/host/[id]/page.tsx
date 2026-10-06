import type { Metadata } from "next";
import { requireAdmin } from "@/features/auth/guards";
import { HostReport } from "@/features/games/components/host/host-report";
import { HostScreen } from "@/features/games/components/host/host-screen";
import { QrCode } from "@/features/games/components/host/qr-code";
import { StageMessage } from "@/features/games/components/stage";
import { bankQuestions } from "@/features/games/content";
import { effectiveStatus } from "@/features/games/domain/scoring";
import {
  hardestQuestions,
  questionStats,
} from "@/features/games/domain/standings";
import { gameCopy, paceCopy } from "@/features/games/messages";
import {
  getRoom,
  getRoomBank,
  getRoomMarks,
  getRoomSnapshot,
} from "@/features/games/queries";
import { RoomIdSchema } from "@/features/games/schemas";
import { roomState } from "@/features/games/service";
import { siteUrl } from "@/lib/site";

const t = gameCopy.host;

export const metadata: Metadata = {
  title: t.pageTitle,
  robots: { index: false, follow: false },
};

/**
 * `/host/[id]` (B-05): the teacher's projector for one room. Any admin may
 * open it (teachers share classes). Once the race is over the page adds the
 * per-question report, which needs the keys: rendered here, admin only.
 */
export default async function HostPage({ params }: PageProps<"/host/[id]">) {
  await requireAdmin();
  const id = RoomIdSchema.safeParse((await params).id);
  const room = id.success ? await getRoom(id.data) : null;
  if (!room)
    return (
      <StageMessage
        pose="telescope"
        title={gameCopy.play.notFound}
        action={{ href: "/admin/games", label: t.backToList }}
      />
    );

  const now = new Date();
  const snapshot = await getRoomSnapshot(room.id, now.getTime());
  const state = roomState(room, snapshot?.players ?? [], null, now);
  const joinUrl = new URL(`/play/${room.pin}`, siteUrl()).toString();
  const joinHost = `${new URL(joinUrl).host}/play`;

  let report = null;
  if (effectiveStatus(room, now) === "finished") {
    const [bank, marks] = await Promise.all([
      getRoomBank(room.id),
      getRoomMarks(room.id),
    ]);
    const questions = bank && (await bankQuestions(bank));
    if (questions) {
      const hardest = hardestQuestions(questionStats(questions.length, marks));
      report = (
        <HostReport
          players={marks.length}
          items={hardest.flatMap((stat) => {
            const question = questions[stat.index];
            return question ? [{ stat, question }] : [];
          })}
        />
      );
    }
  }

  return (
    <HostScreen
      key={state.status}
      roomId={room.id}
      title={room.title}
      pin={room.pin}
      joinUrl={joinUrl}
      joinHost={joinHost}
      qr={
        <QrCode text={joinUrl} label={t.qrLabel(joinUrl)} className="w-full" />
      }
      settings={t.settings(room.bankTypes.length, paceCopy[room.pace].name)}
      initial={state}
      report={report}
    />
  );
}
