"use client";

import { type ComponentProps, lazy, Suspense } from "react";

const ErrorContent = lazy(() => import("./error-content"));

/** Recovery controls are downloaded only when this boundary renders. */
export default function RouteError(props: ComponentProps<typeof ErrorContent>) {
  return (
    <Suspense fallback={null}>
      <ErrorContent {...props} />
    </Suspense>
  );
}
