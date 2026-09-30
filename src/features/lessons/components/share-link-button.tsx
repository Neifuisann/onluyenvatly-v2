"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { shareCopy as t } from "../messages";

/**
 * "Chia sẻ" on a published lesson (S8-03): the system share sheet where
 * there is one (phones, so Zalo is a tap away), else copies the public
 * `/share/lessons/[id]` link. The result is announced politely.
 */
export function ShareLinkButton({
  lessonId,
  title,
}: {
  lessonId: number;
  title: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [failedUrl, setFailedUrl] = useState("");
  async function share() {
    const url = new URL(`/share/lessons/${lessonId}`, window.location.origin)
      .href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch (e) {
      // Closing the share sheet is not a failure.
      if (e instanceof DOMException && e.name === "AbortError") return;
      setFailedUrl(url);
      setStatus("failed");
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="secondary" size="sm" onClick={share}>
        {status === "copied" ? <Check aria-hidden /> : <Share2 aria-hidden />}
        {t.shareButton}
      </Button>
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {status === "copied" && t.copied}
        {status === "failed" && (
          <>
            {t.copyFailed}{" "}
            <span className="select-all break-all">{failedUrl}</span>
          </>
        )}
      </p>
    </div>
  );
}
