"use client";

import { type ComponentProps, lazy, Suspense } from "react";

/** Last boundary for pages without their own (landing, auth, public). */
const RootError = lazy(() => import("@/components/root-error-content"));
export default function RootErrorBoundary(
  props: ComponentProps<typeof RootError>,
) {
  return (
    <Suspense fallback={null}>
      <RootError {...props} />
    </Suspense>
  );
}
