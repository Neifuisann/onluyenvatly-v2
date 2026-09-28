"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect } from "react";
import { shellCopy } from "@/lib/messages";
import {
  nextThemePref,
  resolveDark,
  THEME_STORAGE_KEY,
  type ThemePref,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

const labels: Record<ThemePref, string> = {
  system: shellCopy.themeSystem,
  light: shellCopy.themeLight,
  dark: shellCopy.themeDark,
};

function currentPref(): ThemePref {
  const p = document.documentElement.dataset.themePref;
  return p === "light" || p === "dark" ? p : "system";
}

function apply(pref: ThemePref) {
  const root = document.documentElement;
  const dark = resolveDark(
    pref,
    matchMedia("(prefers-color-scheme: dark)").matches,
  );
  root.classList.toggle("dark", dark);
  root.dataset.themePref = pref;
  root.style.colorScheme = dark ? "dark" : "light";
}

/**
 * Cycles system → light → dark. The icon is picked by CSS from
 * `data-theme-pref` (set before paint), so server and client markup match.
 */
export function ThemeToggle({ className }: { className?: string }) {
  // Follow OS changes while in "system" mode.
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (currentPref() === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const next = nextThemePref(currentPref());
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode: the choice lasts for this page only.
    }
    apply(next);
    e.currentTarget.title = `${shellCopy.themeToggle}: ${labels[next]}`;
  }

  const icon = "size-5 hidden";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={shellCopy.themeToggle}
      title={shellCopy.themeToggle}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <Monitor
        aria-hidden
        strokeWidth={1.75}
        className={cn(icon, "in-data-[theme-pref=system]:block")}
      />
      <Sun
        aria-hidden
        strokeWidth={1.75}
        className={cn(icon, "in-data-[theme-pref=light]:block")}
      />
      <Moon
        aria-hidden
        strokeWidth={1.75}
        className={cn(icon, "in-data-[theme-pref=dark]:block")}
      />
    </button>
  );
}
