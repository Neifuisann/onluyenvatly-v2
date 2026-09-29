import type { Metadata } from "next";
import { ImportPanel } from "@/features/ai/components/admin/import-panel";
import { importCopy as t } from "@/features/ai/messages";
import { requireAdmin } from "@/features/auth/guards";
import { getSettings } from "@/features/settings/queries";

export const metadata: Metadata = { title: t.title };

/**
 * `/admin/import` (05 §1, S7-04): an exam file (PDF, DOCX, image) → AI →
 * the editor's text format → a new draft. Reads only the shared settings.
 */
export default async function AdminImportPage() {
  await requireAdmin();
  const settings = await getSettings();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="space-y-2">
        <h1 className="heading-page">{t.title}</h1>
        <p className="text-muted-foreground">{t.lead}</p>
      </header>
      <ImportPanel aiEnabled={settings.aiEnabled} />
    </div>
  );
}
