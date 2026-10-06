"use client";

import { type RefObject, useEffect, useState } from "react";
import { workspaceCopy as w } from "./messages";

const KEY = "editor.split";
const MIN = 25;
const MAX = 75;
const DEFAULT = 50;

const clamp = (n: number) => Math.min(MAX, Math.max(MIN, Math.round(n)));

/** The preview pane's share of the width in %, remembered in this browser. */
export function useSplit() {
  const [ratio, setRatio] = useState(DEFAULT);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(KEY));
      if (saved) setRatio(clamp(saved));
    } catch {
      // Storage blocked: keep the default.
    }
  }, []);
  const save = (n: number) => {
    try {
      localStorage.setItem(KEY, String(n));
    } catch {
      // Storage blocked: the ratio lasts until reload.
    }
  };
  return [ratio, setRatio, save] as const;
}

/**
 * The drag handle between the preview and the text (v1 `resize-handle`):
 * a focusable separator; ←/→ move it, Home/End go to the limits and a
 * double click resets it.
 */
export function SplitDivider({
  ratio,
  onRatio,
  onCommit,
  container,
  controls,
}: {
  ratio: number;
  onRatio: (n: number) => void;
  onCommit: (n: number) => void;
  container: RefObject<HTMLElement | null>;
  /** Id of the pane whose size this sets. */
  controls: string;
}) {
  const [dragging, setDragging] = useState(false);

  const fromPointer = (x: number) => {
    const box = container.current?.getBoundingClientRect();
    if (!box?.width) return ratio;
    return clamp(((x - box.left) / box.width) * 100);
  };

  const set = (n: number) => {
    onRatio(n);
    onCommit(n);
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: a focusable splitter has no native element; <hr> can't take focus or children
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={w.splitLabel}
      aria-controls={controls}
      aria-valuenow={ratio}
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      tabIndex={0}
      title={w.splitLabel}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
      }}
      onPointerMove={(e) => {
        if (dragging) onRatio(fromPointer(e.clientX));
      }}
      onPointerUp={(e) => {
        setDragging(false);
        onCommit(fromPointer(e.clientX));
      }}
      onDoubleClick={() => set(DEFAULT)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 10 : 2;
        const next =
          e.key === "ArrowLeft"
            ? ratio - step
            : e.key === "ArrowRight"
              ? ratio + step
              : e.key === "Home"
                ? MIN
                : e.key === "End"
                  ? MAX
                  : null;
        if (next === null) return;
        e.preventDefault();
        set(clamp(next));
      }}
      className="group relative z-10 hidden w-2 shrink-0 cursor-col-resize touch-none select-none outline-none lg:block"
    >
      <span
        aria-hidden
        className={
          dragging
            ? "absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-primary"
            : "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:w-0.5 group-hover:bg-primary/60 group-focus-visible:w-0.5 group-focus-visible:bg-primary"
        }
      />
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 flex h-10 w-3 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full border border-border bg-surface shadow-card group-hover:border-primary/60 group-focus-visible:border-primary"
      >
        <span className="size-0.5 rounded-full bg-muted-foreground" />
        <span className="size-0.5 rounded-full bg-muted-foreground" />
        <span className="size-0.5 rounded-full bg-muted-foreground" />
      </span>
    </div>
  );
}
