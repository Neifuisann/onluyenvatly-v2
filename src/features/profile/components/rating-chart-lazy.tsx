"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** Loads Recharts only when the profile chart renders (14 §5, 08 §1). */
export const RatingChartLazy = dynamic(() => import("./rating-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full rounded-lg" />,
});
