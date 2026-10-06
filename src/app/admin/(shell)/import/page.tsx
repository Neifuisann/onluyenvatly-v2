import type { Metadata } from "next";
import { Mascot } from "@/components/mascot";
import { PageHeader } from "@/components/page-header";
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
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex items-end gap-6">
        <PageHeader title={t.title} lead={t.lead} className="flex-1" />
        <Mascot pose="laptop" size={120} className="hidden shrink-0 md:block" />
      </div>
      <ol
        aria-label={t.stepsLabel}
        className="grid gap-2 text-sm sm:grid-cols-3"
      >
        {t.steps.map((step, i) => (
          <li
            key={step}
            className="flex items-center gap-2.5 rounded-full bg-muted px-2 py-1.5 font-medium"
          >
            <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-bold font-display text-primary-foreground text-xs">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <ImportPanel aiEnabled={settings.aiEnabled} />
    </div>
  );
}
