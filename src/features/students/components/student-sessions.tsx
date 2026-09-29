import { formatDateTime } from "@/lib/dates";
import type { StudentSessionRow } from "../admin-queries";
import { shortUserAgent } from "../domain/user-agent";
import { studentsCopy as t } from "../messages";

/** Sessions that haven't expired: device, IP, when they started and were last seen. */
export function StudentSessions({
  rows,
}: {
  rows: readonly StudentSessionRow[];
}) {
  return (
    <ul className="divide-y rounded-lg border bg-surface">
      {rows.map((s) => (
        <li
          // A session has no public id; time of creation is unique enough per user.
          key={`${s.createdAt.getTime()}-${s.lastSeenAt.getTime()}`}
          className="px-4 py-3"
        >
          <p className="font-medium text-sm">
            {shortUserAgent(s.userAgent) ?? t.unknownDevice}
          </p>
          <p className="mt-0.5 text-muted-foreground text-xs">
            {[
              s.ip && t.sessionIp(s.ip),
              t.sessionCreated(formatDateTime(s.createdAt)),
              t.sessionSeen(formatDateTime(s.lastSeenAt)),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </li>
      ))}
    </ul>
  );
}
