import {
  CircleAlert,
  Copy,
  EyeOff,
  type LucideIcon,
  Minimize,
  MousePointerClick,
  ShieldCheck,
} from "lucide-react";
import type { GuardEvent } from "@/db/schema";
import { formatClock } from "@/lib/dates";
import { guardTimeline, type TimelineEntry } from "../../domain/guard";
import { guardCopy as t } from "../../messages";

const ICONS: Record<TimelineEntry["kind"], LucideIcon> = {
  blur: MousePointerClick,
  hidden: EyeOff,
  "fs-exit": Minimize,
  copy: Copy,
  other: CircleAlert,
};

/**
 * Exam-guard events for the teacher (S6-04, 06 §3): time since the start
 * (mm:ss), what happened, an icon. Server-rendered; students never get it.
 */
export function GuardTimeline({ events }: { events: readonly GuardEvent[] }) {
  const entries = guardTimeline(events);
  return (
    <section
      aria-labelledby="guard-heading"
      className="flex flex-col gap-3 rounded-lg border bg-surface p-4"
    >
      <div className="space-y-1">
        <h2 id="guard-heading" className="font-semibold">
          {t.heading(entries.length)}
        </h2>
        <p className="text-muted-foreground text-sm">{t.lead}</p>
      </div>
      {entries.length === 0 ? (
        <p className="flex items-center gap-2 text-muted-foreground text-sm">
          <ShieldCheck
            aria-hidden
            className="size-4 shrink-0 text-success-text"
          />
          {t.empty}
        </p>
      ) : (
        <ol aria-label={t.listLabel} className="flex flex-col">
          {entries.map((e, i) => {
            const Icon = ICONS[e.kind];
            return (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list, repeats allowed
                key={i}
                className="relative flex items-center gap-3 py-1.5 pl-1"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warning/25 text-foreground">
                  <Icon aria-hidden className="size-4" strokeWidth={1.75} />
                </span>
                <span className="w-14 shrink-0 num text-sm tabular-nums">
                  {formatClock(e.t)}
                </span>
                <span className="min-w-0 text-sm">{t.kinds[e.kind]}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
