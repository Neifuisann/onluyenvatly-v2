import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { AiUsageToday } from "@/features/ai/budget";
import { statsHref } from "@/features/lessons/domain/stats";
import { cn } from "@/lib/utils";
import { barLayout } from "../domain/chart";
import {
  type DayCount,
  formatDayMonth,
  type HardQuestion,
} from "../domain/overview";
import { overviewCopy as t } from "../messages";

function Tile({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <>
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd
        className={cn(
          "num font-semibold text-2xl tabular-nums",
          muted && "font-sans text-lg text-muted-foreground",
        )}
      >
        {value}
      </dd>
    </>
  );
}

const tileBox =
  "flex flex-col gap-1 rounded-lg border bg-surface p-4 shadow-card";

/** The headline numbers; the pending tile opens the approval queue. */
export function OverviewTiles({
  pending,
  activeStudents,
  attemptsToday,
  attemptsWeek,
  ai,
}: {
  pending: number;
  activeStudents: number;
  attemptsToday: number;
  attemptsWeek: number;
  ai: AiUsageToday;
}) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <div
        className={cn(
          tileBox,
          "relative focus-within:ring-2 focus-within:ring-ring",
          pending > 0 && "border-primary",
        )}
      >
        <dt className="text-muted-foreground text-sm">
          <Link
            href="/admin/students?view=pending"
            prefetch={false}
            aria-label={t.pendingLink(pending)}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {t.pending}
          </Link>
        </dt>
        <dd className="flex items-center justify-between num font-semibold text-2xl tabular-nums">
          {pending}
          <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
        </dd>
      </div>
      <div className={tileBox}>
        <Tile label={t.active} value={String(activeStudents)} />
      </div>
      <div className={tileBox}>
        <Tile label={t.today} value={String(attemptsToday)} />
      </div>
      <div className={tileBox}>
        <Tile label={t.week} value={String(attemptsWeek)} />
      </div>
      <div className={tileBox}>
        {ai.enabled ? (
          <Tile label={t.ai} value={t.aiUsage(ai.used, ai.budget)} />
        ) : (
          <Tile label={t.ai} value={t.aiOff} muted />
        )}
      </div>
    </dl>
  );
}

const W = 300;
const H = 100;

/**
 * Attempts per Vietnam day as a server-rendered SVG (no chart JS). The
 * summary sentence is the accessible text; each bar has a `<title>` for
 * pointer users.
 */
export function AttemptsChart({ days }: { days: readonly DayCount[] }) {
  const bars = barLayout(
    days.map((d) => d.count),
    W,
    H,
    2,
  );
  const total = days.reduce((s, d) => s + d.count, 0);
  const top = days.reduce<DayCount | null>(
    (best, d) => (d.count > (best?.count ?? 0) ? d : best),
    null,
  );
  const first = days[0];
  const summary = t.chartSummary(
    total,
    top?.count ?? 0,
    top ? formatDayMonth(top.day) : null,
  );
  return (
    <section
      aria-labelledby="chart-heading"
      className="flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card"
    >
      <h2 id="chart-heading" className="font-semibold">
        {t.chartTitle}
      </h2>
      <p className="text-muted-foreground text-sm">{summary}</p>
      <svg
        role="img"
        aria-label={`${t.chartTitle}. ${summary}`}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-32 w-full"
      >
        <line
          x1="0"
          y1={H}
          x2={W}
          y2={H}
          className="stroke-border"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {bars.map((b, i) => {
          const d = days[i];
          if (!d) return null;
          return (
            <rect
              key={d.day}
              x={b.x}
              y={b.y}
              width={b.width}
              height={b.height}
              rx="1"
              className="fill-primary"
              data-count={d.count}
            >
              <title>{t.bar(formatDayMonth(d.day), d.count)}</title>
            </rect>
          );
        })}
      </svg>
      <div
        aria-hidden
        className="flex justify-between text-muted-foreground text-xs"
      >
        <span>{first ? t.chartStart(formatDayMonth(first.day)) : ""}</span>
        <span>{t.chartEnd}</span>
      </div>
    </section>
  );
}

/** This week's hardest questions, each linking to its lesson's stats. */
export function HardestList({ items }: { items: readonly HardQuestion[] }) {
  return (
    <section
      aria-labelledby="hardest-heading"
      className="flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card"
    >
      <div className="space-y-1">
        <h2 id="hardest-heading" className="font-semibold">
          {t.hardestTitle}
        </h2>
        <p className="text-muted-foreground text-sm">{t.hardestLead}</p>
      </div>
      {items.length ? (
        <ol className="flex flex-col divide-y">
          {items.map((h) => {
            const question = t.question(h.position);
            return (
              <li key={`${h.lessonId}:${h.questionId}`}>
                <Link
                  href={statsHref(h.lessonId, {
                    version: h.versionId,
                    sort: "hardest",
                  })}
                  prefetch={false}
                  className="flex min-h-11 items-center gap-3 py-2 hover:bg-muted/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium">{h.lessonTitle}</p>
                    <p className="text-muted-foreground text-sm">
                      {question} ·{" "}
                      {t.hardestRate(
                        `${Math.round(h.fullMarksRate * 100)}%`,
                        h.fullMarks,
                        h.answers,
                      )}
                    </p>
                  </div>
                  <ChevronRight
                    aria-hidden
                    className="size-5 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-muted-foreground text-sm">{t.hardestEmpty}</p>
      )}
    </section>
  );
}
