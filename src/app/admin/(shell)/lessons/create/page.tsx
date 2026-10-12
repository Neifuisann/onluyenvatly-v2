import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ImportPanel } from "@/features/ai/components/admin/import-panel";
import { importCopy } from "@/features/ai/messages";
import { solverConfig } from "@/features/ai/solve-service";
import { requireTeacher } from "@/features/auth/guards";
import { getComposeSources } from "@/features/lessons/admin-queries";
import { ComposePanel } from "@/features/lessons/components/admin/compose-panel";
import { CreateChoices } from "@/features/lessons/components/admin/create-choices";
import { CreateVideoForm } from "@/features/lessons/components/admin/create-video-form";
import { createCopy as t } from "@/features/lessons/messages";
import { getSettings } from "@/features/settings/queries";

export const metadata: Metadata = { title: t.title };

/**
 * `/admin/lessons/create[?mode=file|compose|video]` (S5-07): how a new
 * lesson starts, like Azota's "Tạo đề mới". Without a mode, the choices;
 * `file` is the AI import (S7-04), `compose` draws a review lesson from
 * other lessons, `video` starts a video lesson from a YouTube link. Each
 * mode reads only what it needs.
 */
export default async function CreateLessonPage({
  searchParams,
}: PageProps<"/admin/lessons/create">) {
  const user = await requireTeacher();
  const { mode } = await searchParams;

  if (mode === "compose") {
    const sources = await getComposeSources(user);
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <PageHeader
          back={{ href: "/admin/lessons/create", label: t.backToChoices }}
          title={t.composeTitle}
          lead={t.compose.body}
        />
        <ComposePanel sources={sources} />
      </div>
    );
  }

  if (mode === "video")
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <PageHeader
          back={{ href: "/admin/lessons/create", label: t.backToChoices }}
          title={t.videoTitle}
          lead={t.video.body}
        />
        <CreateVideoForm />
      </div>
    );

  const settings = await getSettings();
  if (mode === "file")
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <PageHeader
          back={{ href: "/admin/lessons/create", label: t.backToChoices }}
          title={t.fileTitle}
          lead={importCopy.lead}
        />
        <ImportPanel
          aiEnabled={settings.aiEnabled}
          solverEnabled={settings.aiEnabled && solverConfig() !== null}
        />
      </div>
    );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        back={{ href: "/admin/lessons", label: t.back }}
        title={t.title}
        lead={t.lead}
      />
      <CreateChoices aiEnabled={settings.aiEnabled} />
    </div>
  );
}
