import { Info } from "lucide-react";
import type { Metadata } from "next";
import { requireAdmin } from "@/features/auth/guards";
import { getAdmins } from "@/features/settings/admin-queries";
import { AdminList } from "@/features/settings/components/admin-list";
import { CreateAdminForm } from "@/features/settings/components/create-admin-form";
import { SettingsForm } from "@/features/settings/components/settings-form";
import { settingsCopy as t } from "@/features/settings/messages";
import { getSettings } from "@/features/settings/queries";

export const metadata: Metadata = { title: t.title };

/**
 * `/admin/settings` (S6-03): the global settings row and the admin accounts.
 * The settings come from the shared cache that `updateSettings` invalidates;
 * the admin list is read per request.
 */
export default async function AdminSettingsPage() {
  const user = await requireAdmin();
  const [settings, admins] = await Promise.all([getSettings(), getAdmins()]);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="space-y-2">
        <h1 className="font-semibold text-2xl">{t.title}</h1>
        <p className="text-muted-foreground">{t.lead}</p>
      </header>

      <section
        aria-labelledby="settings-general"
        className="flex flex-col gap-4 rounded-lg border bg-surface p-4"
      >
        <div className="space-y-1">
          <h2 id="settings-general" className="font-semibold">
            {t.generalSection}
          </h2>
          <p className="text-muted-foreground text-sm">{t.generalLead}</p>
        </div>
        <SettingsForm initial={settings} />
        <p className="flex items-start gap-2 text-muted-foreground text-xs">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t.notInScope}
        </p>
      </section>

      <section aria-labelledby="settings-admins" className="space-y-3">
        <div className="space-y-1">
          <h2 id="settings-admins" className="font-semibold">
            {t.adminsSection}
          </h2>
          <p className="text-muted-foreground text-sm">{t.adminsLead}</p>
        </div>
        <AdminList rows={admins} currentId={user.id} />
      </section>

      <section
        aria-labelledby="settings-create-admin"
        className="flex flex-col gap-4 rounded-lg border bg-surface p-4"
      >
        <div className="space-y-1">
          <h2 id="settings-create-admin" className="font-semibold">
            {t.createSection}
          </h2>
          <p className="text-muted-foreground text-sm">{t.createLead}</p>
        </div>
        <CreateAdminForm />
      </section>
    </div>
  );
}
