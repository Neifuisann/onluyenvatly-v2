"use client";

import { Check, CloudOff, HardDrive, LoaderCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveCopy as t } from "../../messages";
import type { SaveStatus } from "./use-autosave";

const view = {
  saved: { icon: Check, text: t.saved, tone: "text-success-text" },
  local: { icon: HardDrive, text: t.local, tone: "text-muted-foreground" },
  saving: { icon: LoaderCircle, text: t.saving, tone: "text-muted-foreground" },
  offline: { icon: CloudOff, text: t.offline, tone: "text-danger-text" },
  closed: { icon: Lock, text: t.closed, tone: "text-muted-foreground" },
  "signed-out": { icon: Lock, text: t.signedOut, tone: "text-danger-text" },
} satisfies Record<SaveStatus, unknown>;

/** Always visible save state (07 §4), icon + words, announced politely. */
export function SaveIndicator({ status }: { status: SaveStatus }) {
  const { icon: Icon, text, tone } = view[status];
  return (
    // <output> has the implicit `status` role: announced politely.
    <output
      className={cn(
        "flex shrink-0 items-center gap-1 whitespace-nowrap text-xs",
        tone,
      )}
    >
      <Icon
        aria-hidden
        className={cn("size-3.5", status === "saving" && "animate-spin")}
      />
      {text}
    </output>
  );
}
