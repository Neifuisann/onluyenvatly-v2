"use client";

import dynamic from "next/dynamic";

/** Last boundary for pages without their own (landing, auth, public). */
const RootError = dynamic(() => import("@/components/root-error-content"));
export default RootError;
