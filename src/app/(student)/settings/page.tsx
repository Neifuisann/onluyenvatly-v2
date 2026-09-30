import { Download, KeyRound, Monitor, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, SectionCard } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  DeletionPanel,
  PrivacyToggle,
  RevokeSessionButton,
} from "@/features/account/components/account-controls";
import { AvatarEditor } from "@/features/account/components/avatar-editor";
import { ProfileForm } from "@/features/account/components/profile-form";
import { accountCopy as t } from "@/features/account/messages";
import { getMyAccount, getMySessions } from "@/features/account/queries";
import { requireStudent } from "@/features/auth/guards";
import { initials } from "@/features/rating/domain/leaderboard";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: t.title };

/**
 * `/settings` (S8-04, 05 §1): my profile, avatar, password, privacy,
 * devices, data export and deletion request. Two per-user reads, uncached.
 */
export default async function SettingsPage() {
  const user = await requireStudent();
  const [account, sessions] = await Promise.all([
    getMyAccount(user.id),
    getMySessions(user.id, user.sessionId),
  ]);
  if (!account) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={t.title}
        lead={t.lead}
        back={{ href: "/profile", label: t.back }}
      />

      <SectionCard id="avatar-title" title={t.avatarTitle} lead={t.avatarLead}>
        <AvatarEditor
          path={account.avatarPath}
          initials={initials(account.fullName)}
        />
      </SectionCard>

      <SectionCard
        id="profile-title"
        title={t.profileTitle}
        lead={t.profileLead}
      >
        <dl className="grid gap-3 rounded-md bg-muted/60 p-4 text-sm sm:grid-cols-2">
          {account.phone && (
            <div>
              <dt className="text-muted-foreground">{t.phone}</dt>
              <dd className="num font-semibold">{account.phone}</dd>
              <dd className="text-muted-foreground text-xs">{t.phoneHint}</dd>
            </div>
          )}
          {account.username && (
            <div>
              <dt className="text-muted-foreground">{t.username}</dt>
              <dd className="font-semibold">{account.username}</dd>
            </div>
          )}
        </dl>
        <ProfileForm
          defaults={{
            fullName: account.fullName,
            dateOfBirth: account.dateOfBirth ?? "",
            grade: account.grade ? String(account.grade) : "",
            className: account.className ?? "",
          }}
        />
      </SectionCard>

      <SectionCard
        id="password-title"
        title={t.passwordTitle}
        lead={t.passwordLead}
      >
        <Link
          href="/change-password?next=/settings"
          prefetch={false}
          className={buttonVariants({
            variant: "secondary",
            className: "w-fit",
          })}
        >
          <KeyRound aria-hidden />
          {t.passwordCta}
        </Link>
      </SectionCard>

      <SectionCard id="privacy-title" title={t.privacyTitle}>
        <PrivacyToggle initial={account.leaderboardInitials} />
      </SectionCard>

      <SectionCard
        id="sessions-title"
        title={t.sessionsTitle}
        lead={t.sessionsLead}
      >
        <ul className="divide-y divide-border">
          {sessions.map((s) => {
            const device = s.device ?? t.unknownDevice;
            const Icon = /Android|iOS|iPhone|iPad/i.test(device)
              ? Smartphone
              : Monitor;
            return (
              <li
                key={s.handle}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Icon
                  aria-hidden
                  className="size-6 shrink-0 text-muted-foreground"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {device}
                    {s.current && " "}
                    {s.current && (
                      <span className="ml-1 rounded-full bg-primary-soft px-2 py-0.5 font-medium text-xs">
                        {t.thisDevice}
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {t.lastSeen(formatDateTime(s.lastSeenAt))}
                    {s.ip && ` · ${s.ip}`}
                  </p>
                </div>
                {!s.current && (
                  <RevokeSessionButton handle={s.handle} device={device} />
                )}
              </li>
            );
          })}
        </ul>
        {sessions.length <= 1 && (
          <p className="text-muted-foreground text-sm">{t.sessionsEmpty}</p>
        )}
      </SectionCard>

      <SectionCard id="export-title" title={t.exportTitle} lead={t.exportLead}>
        {/* A download, not a page: plain <a> so the browser saves the file. */}
        <a
          href="/settings/export"
          download
          className={buttonVariants({
            variant: "secondary",
            className: "w-fit",
          })}
        >
          <Download aria-hidden />
          {t.exportCta}
        </a>
      </SectionCard>

      <SectionCard
        id="delete-title"
        title={t.deleteTitle}
        lead={t.deleteLead}
        className="border-danger/40 dark:border-danger/40"
      >
        <DeletionPanel
          isAdmin={user.role === "admin"}
          requestedAt={
            account.deletionRequestedAt
              ? formatDateTime(account.deletionRequestedAt)
              : null
          }
        />
      </SectionCard>
    </div>
  );
}
