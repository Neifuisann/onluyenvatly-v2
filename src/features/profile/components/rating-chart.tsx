"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRating, ratingCopy } from "@/features/rating/messages";
import { formatDateTime } from "@/lib/dates";

export type ChartPoint = { t: number; r: number };

const dayMonth = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
});

/** `28/09`, whatever separator the locale data uses. */
const shortDate = (t: number) => {
  const p = Object.fromEntries(
    dayMonth.formatToParts(t).map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}`;
};

/** Round the axis to 50s so the ticks read 1 500, 1 550, … */
const STEP = 50;
const yDomain: [(min: number) => number, (max: number) => number] = [
  (min) => Math.floor((min - 10) / STEP) * STEP,
  (max) => Math.ceil((max + 10) / STEP) * STEP,
];

const tick = { fill: "var(--color-muted-foreground)", fontSize: 12 };

/**
 * Rating over time (07 §4 `RatingChart`). Recharts is heavy, so this module is
 * only reached through `RatingChartLazy` on `/profile` (08 §1).
 */
export default function RatingChart({ points }: { points: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={224}>
      <LineChart
        data={points}
        margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
      >
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={shortDate}
          tick={tick}
          stroke="var(--color-border)"
          minTickGap={28}
        />
        <YAxis
          domain={yDomain}
          tickCount={5}
          tickFormatter={(r: number) => formatRating(Math.round(r))}
          tick={tick}
          stroke="var(--color-border)"
          allowDecimals={false}
          width={52}
        />
        <Tooltip
          labelFormatter={(t) => formatDateTime(new Date(Number(t)))}
          formatter={(r) => [formatRating(Number(r)), ratingCopy.label]}
          contentStyle={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            color: "var(--color-foreground)",
          }}
        />
        <Line
          type="linear"
          dataKey="r"
          stroke="var(--color-primary)"
          strokeWidth={2}
          dot={points.length <= 30}
          // Calm UI, and nothing moves under reduced motion (07 §3.3).
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
