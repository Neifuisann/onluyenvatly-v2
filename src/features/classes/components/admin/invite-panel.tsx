"use client";

import { Check, Copy, RefreshCw } from "lucide-react";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resetJoinCode } from "../../actions";
import { joinPath } from "../../domain/invite";
import { classesCopy as t } from "../../messages";
import { ConfirmButton } from "./confirm-button";

const noSubscribe = () => () => {};

/** This site's origin in the browser; "" while rendering on the server. */
export function useOrigin(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => "",
  );
}

/**
 * "Liên kết mời vào lớp" (B-03): the class's `/join/<code>` link to copy,
 * and "Đổi liên kết" to replace the code (old links stop working).
 */
export function InvitePanel({
  classId,
  joinCode,
  archived,
}: {
  classId: number;
  joinCode: string;
  archived: boolean;
}) {
  const origin = useOrigin();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; error: boolean }>();
  const url = `${origin}${joinPath(joinCode)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setMessage({ text: t.inviteCopied, error: false });
    } catch {
      setMessage({ text: t.inviteCopyFailed, error: true });
    }
  };

  const reset = () =>
    startTransition(async () => {
      const result = await resetJoinCode(classId);
      setMessage(
        result.ok
          ? { text: t.resetInviteDone, error: false }
          : { text: result.message, error: true },
      );
    });

  return (
    <div className="grid gap-4">
      <dl className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-x-6">
        <dt className="font-medium text-muted-foreground text-sm">
          {t.inviteCode}
        </dt>
        <dd className="num font-bold font-display text-2xl tracking-[0.2em]">
          {joinCode}
        </dd>
        <dt className="font-medium text-muted-foreground text-sm">
          {t.inviteLink}
        </dt>
        <dd className="select-all break-all rounded-lg bg-muted px-3 py-2 font-mono text-sm">
          {url}
        </dd>
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={copy} disabled={archived}>
          {message?.text === t.inviteCopied ? (
            <Check aria-hidden />
          ) : (
            <Copy aria-hidden />
          )}
          {t.copyInvite}
        </Button>
        <ConfirmButton
          label={
            <>
              <RefreshCw aria-hidden />
              {t.resetInvite}
            </>
          }
          title={t.resetInvite}
          body={t.resetInviteConfirm}
          confirmLabel={t.resetInvite}
          onConfirm={reset}
          disabled={pending}
        />
      </div>
      <output
        aria-live="polite"
        className={cn(
          "min-h-5 text-sm empty:hidden",
          message?.error ? "text-danger-text" : "text-muted-foreground",
        )}
      >
        {message?.text}
      </output>
    </div>
  );
}
