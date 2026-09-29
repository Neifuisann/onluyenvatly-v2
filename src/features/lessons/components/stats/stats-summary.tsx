import { formatScore } from "@/lib/dates";
import type { LessonStats } from "../../domain/stats";
import { statsCopy as t } from "../../messages";

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-surface p-4 shadow-card">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="font-mono font-semibold text-2xl tabular-nums">{value}</dd>
    </div>
  );
}

/** Attempts, students, average and median score /10 (S6-05). */
export function StatsSummary({ stats }: { stats: LessonStats }) {
  const score = (x: number | null) => (x === null ? "–" : formatScore(x));
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile label={t.attempts} value={String(stats.attempts)} />
      <Tile label={t.students} value={String(stats.students)} />
      <Tile label={t.average} value={score(stats.average)} />
      <Tile label={t.median} value={score(stats.median)} />
    </dl>
  );
}

/**
 * Score distribution as server-rendered CSS columns (no chart JS): the count
 * above each column is the text, the column only illustrates it.
 */
export function ScoreHistogram({
  distribution,
}: {
  distribution: readonly number[];
}) {
  const max = Math.max(1, ...distribution);
  return (
    <section
      aria-labelledby="histogram-heading"
      className="flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card"
    >
      <h2 id="histogram-heading" className="font-semibold">
        {t.distribution}
      </h2>
      <ol className="grid grid-cols-10 items-end gap-1">
        {distribution.map((n, i) => {
          const last = i === distribution.length - 1;
          const label = last ? `${i}–10` : `${i}–${i + 1}`;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed buckets 0–9
            <li key={i} className="flex flex-col items-center gap-1">
              <span className="sr-only">{t.bucket(i, last, n)}</span>
              <span
                aria-hidden
                className="font-mono text-muted-foreground text-xs tabular-nums"
              >
                {n}
              </span>
              <div aria-hidden className="flex h-28 w-full items-end">
                <div
                  className="w-full rounded-t-sm bg-primary"
                  style={{
                    height: n ? `${Math.max(2, (n / max) * 100)}%` : "0",
                  }}
                />
              </div>
              <span
                aria-hidden
                className="w-full border-t pt-1 text-center text-[0.65rem] text-muted-foreground tabular-nums sm:text-xs"
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
