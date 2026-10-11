import { formatDateTime } from "@/lib/dates";
import type { AdminAccountRow } from "../admin-queries";
import { settingsCopy as t } from "../messages";

/** Admin accounts: name, username, last login (S6-03). */
export function AdminList({
  rows,
  currentId,
}: {
  rows: readonly AdminAccountRow[];
  currentId: string;
}) {
  if (rows.length === 0)
    return <p className="text-muted-foreground text-sm">{t.adminsEmpty}</p>;
  return (
    <ul
      aria-label={t.adminsLabel}
      className="divide-y rounded-lg border border-border/70 bg-surface shadow-card dark:border-border"
    >
      {rows.map((a) => (
        <li key={a.id} className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-words font-medium">{a.fullName}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
              {a.role === "admin" ? t.roleAdmin : t.roleTeacher}
            </span>
            {a.id === currentId && (
              <span className="rounded-full bg-primary-soft px-2 py-0.5 font-medium text-primary text-xs">
                {t.you}
              </span>
            )}
          </div>
          <p className="mt-1 break-words text-muted-foreground text-xs">
            {[
              a.username && t.username(a.username),
              a.lastLoginAt
                ? t.lastLogin(formatDateTime(a.lastLoginAt))
                : t.neverLoggedIn,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </li>
      ))}
    </ul>
  );
}
