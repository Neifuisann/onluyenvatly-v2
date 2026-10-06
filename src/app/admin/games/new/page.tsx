import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/features/auth/guards";
import { CreateGameForm } from "@/features/games/components/admin/create-form";
import { lessonAllowsGame } from "@/features/games/domain/bank";
import { gameCopy } from "@/features/games/messages";
import { getGameLessonChoices } from "@/features/games/queries";
import { LessonConfigSchema } from "@/features/lessons/schema";

const t = gameCopy.create;

export const metadata: Metadata = { title: t.title };

/**
 * `/admin/games/new` (B-05): pick lessons, types, size and pace. Lessons
 * whose keys are hidden right now are listed but can't be chosen.
 */
export default async function NewGamePage() {
  await requireAdmin();
  const now = new Date();
  const lessons = (await getGameLessonChoices()).map(
    ({ config, versionId: _versionId, ...l }) => {
      const parsed = LessonConfigSchema.safeParse(config);
      return {
        ...l,
        allowed: parsed.success && lessonAllowsGame(parsed.data, now),
      };
    },
  );
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title={t.title}
        lead={t.lead}
        back={{ href: "/admin/games", label: t.back }}
      />
      <CreateGameForm lessons={lessons} />
    </div>
  );
}
