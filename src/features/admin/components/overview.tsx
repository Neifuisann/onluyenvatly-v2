import {
  ArrowRight,
  ChevronRight,
  ClipboardList,
  type LucideIcon,
  Send,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Mascot } from "@/components/mascot";
import { buttonVariants } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
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

/**
 * The navy hero (the student dashboard's "continue" surface): the approval
 * queue when someone waits, else today's activity.
 */
export function OverviewHero({
  pending,
  attemptsToday,
}: {
  pending: number;
  attemptsToday: number;
}) {
  const waiting = pending > 0;
  return (
    <section
      aria-labelledby="overview-hero"
      className="relative isolate flex animate-rise items-end gap-4 overflow-hidden rounded-xl bg-ink p-5 text-ink-foreground shadow-raised sm:p-7"
    >
      <span
        aria-hidden
        className="-z-10 -right-24 -top-24 absolute size-72 rounded-full bg-primary/35 blur-3xl"
      />
      <div className="min-w-0 flex-1 space-y-3">
        <p className="eyebrow inline-flex items-center gap-2 text-ink-muted">
          <span aria-hidden className="size-2 rounded-full bg-accent" />
          {waiting ? t.heroPendingLabel : t.heroTodayLabel}
        </p>
        <h2
          id="overview-hero"
          className="font-display font-semibold text-2xl leading-tight tracking-tight sm:text-[1.75rem]"
        >
          {waiting ? t.heroPending(pending) : t.heroToday(attemptsToday)}
        </h2>
        <p className="max-w-md text-ink-muted">
          {waiting ? t.heroPendingBody : t.heroTodayBody}
        </p>
        <Link
          href={waiting ? "/admin/students?view=pending" : "/admin/results"}
          prefetch={false}
          className={buttonVariants({
            variant: "ink",
            size: "lg",
            className: "mt-1",
          })}
        >
          {waiting ? t.heroPendingCta : t.heroTodayCta}
          <ArrowRight aria-hidden />
        </Link>
      </div>
      <Mascot
        pose={waiting ? "waiting" : "graph"}
        size={150}
        priority
        className="-mb-2 hidden shrink-0 sm:block"
      />
    </section>
  );
}

const tileBox = cn(
  cardClass,
  "flex min-w-0 flex-col gap-3 p-4 sm:p-5 transition-[transform,box-shadow,border-color] duration-200",
);

function Tile({
  icon: Icon,
  tone,
  label,
  value,
  muted,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className={tileBox}>
      <span
        aria-hidden
        className={cn(
          "flex size-10 items-center justify-center rounded-full",
          tone,
        )}
      >
        <Icon className="size-5" strokeWidth={2} />
      </span>
      <dt className="text-muted-foreground text-sm leading-snug">{label}</dt>
      <dd
        className={cn(
          "num mt-auto font-bold font-display text-3xl leading-none tracking-tight",
          muted && "font-sans font-semibold text-lg text-muted-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

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
    <dl className="grid animate-rise grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      <div
        className={cn(
          tileBox,
          "relative col-span-2 focus-within:ring-2 focus-within:ring-ring hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised lg:col-span-1",
          pending > 0 &&
            "border-accent/60 bg-accent-soft dark:border-accent/40",
        )}
      >
        <span
          aria-hidden
          className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground"
        >
          <UserCheck className="size-5" strokeWidth={2} />
        </span>
        <dt className="text-muted-foreground text-sm">
          <Link
            href="/admin/students?view=pending"
            prefetch={false}
            aria-label={t.pendingLink(pending)}
            className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none"
          >
            {t.pending}
          </Link>
        </dt>
        <dd className="num mt-auto flex items-center justify-between font-bold font-display text-3xl leading-none tracking-tight">
          {pending}
          <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
        </dd>
      </div>
      <Tile
        icon={Users}
        tone="bg-primary-soft text-primary"
        label={t.active}
        value={String(activeStudents)}
      />
      <Tile
        icon={Send}
        tone="bg-success-soft text-success-text"
        label={t.today}
        value={String(attemptsToday)}
      />
      <Tile
        icon={ClipboardList}
        tone="bg-peach text-danger-text"
        label={t.week}
        value={String(attemptsWeek)}
      />
      {ai.enabled ? (
        <Tile
          icon={Sparkles}
          tone="bg-ink text-accent"
          label={t.ai}
          value={t.aiUsage(ai.used, ai.budget)}
        />
      ) : (
        <Tile
          icon={Sparkles}
          tone="bg-muted text-muted-foreground"
          label={t.ai}
          value={t.aiOff}
          muted
        />
      )}
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
      className={cn(cardClass, "flex flex-col gap-3 p-5 sm:p-6")}
    >
      <h2 id="chart-heading" className="heading-section">
        {t.chartTitle}
      </h2>
      <p className="text-muted-foreground text-sm">{summary}</p>
      <svg
        role="img"
        aria-label={`${t.chartTitle}. ${summary}`}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-auto h-40 w-full"
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
              rx="1.5"
              className={cn(
                i === bars.length - 1 ? "fill-accent" : "fill-primary",
              )}
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
      className={cn(cardClass, "flex flex-col gap-3 p-5 sm:p-6")}
    >
      <div className="space-y-1">
        <h2 id="hardest-heading" className="heading-section">
          {t.hardestTitle}
        </h2>
        <p className="text-muted-foreground text-sm">{t.hardestLead}</p>
      </div>
      {items.length ? (
        <ol className="-mx-2 flex flex-col">
          {items.map((h, i) => {
            const rate = Math.round(h.fullMarksRate * 100);
            return (
              <li key={`${h.lessonId}:${h.questionId}`}>
                <Link
                  href={statsHref(h.lessonId, {
                    version: h.versionId,
                    sort: "hardest",
                  })}
                  prefetch={false}
                  className="group flex min-h-11 items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/60"
                >
                  <span
                    aria-hidden
                    className="num flex size-8 shrink-0 items-center justify-center rounded-full bg-danger-soft font-bold font-display text-danger-text text-sm"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold">{h.lessonTitle}</p>
                    <p className="text-muted-foreground text-sm">
                      {t.question(h.position)} ·{" "}
                      {t.hardestRate(`${rate}%`, h.fullMarks, h.answers)}
                    </p>
                    <div
                      aria-hidden
                      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                    >
                      <div
                        className="h-full rounded-full bg-danger"
                        style={{ width: `${Math.max(rate, 2)}%` }}
                      />
                    </div>
                  </div>
                  <ChevronRight
                    aria-hidden
                    className="size-5 shrink-0 text-muted-foreground transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-primary"
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
