"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  detectInAppBrowser,
  externalBrowserUrl,
  type InAppBrowser,
} from "@/lib/in-app-browser";
import { inAppBrowserCopy as t } from "@/lib/messages";

/** "Continue here" lasts for the tab, so the sheet does not nag on every page. */
const DISMISS_KEY = "ovl-in-app-dismissed";

/**
 * Asks students who opened a shared link inside Zalo, Messenger… to reopen
 * it in a real browser (`lib/in-app-browser.ts`). Mounted once in the root
 * layout; renders nothing on the server and in real browsers.
 */
export function InAppBrowserPrompt() {
  const [browser, setBrowser] = useState<InAppBrowser | null>(null);
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const detected = detectInAppBrowser(navigator.userAgent);
    if (!detected) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {}
    setBrowser(detected);
    setHref(externalBrowserUrl(location.href, detected.os));
    setOpen(true);
  }, []);

  if (!browser) return null;

  const close = () => {
    setOpen(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
    } catch {
      // Older webviews block the clipboard; the app menu route still works.
    }
  };

  const manual =
    browser.os === "ios"
      ? t.manualIos
      : browser.os === "android"
        ? t.manualAndroid
        : t.manualOther;

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t.title}
      closeLabel={t.stay}
      variant="sheet"
    >
      <div className="space-y-4 text-sm leading-relaxed">
        <p>{t.lead(t.apps[browser.app])}</p>
        <p className="font-semibold">{t.advice}</p>
        <div className="flex flex-col gap-2">
          {href && (
            <a
              href={href}
              rel="noopener"
              className={buttonVariants({ size: "lg", className: "w-full" })}
            >
              <ExternalLink aria-hidden />
              {t.open}
            </a>
          )}
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={copy}
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? t.copied : t.copy}
          </Button>
        </div>
        <p className="text-muted-foreground">{manual}</p>
        <div className="text-center">
          <Button type="button" variant="link" onClick={close}>
            {t.stay}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
