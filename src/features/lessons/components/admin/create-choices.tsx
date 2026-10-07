import {
  ArrowRight,
  FileUp,
  type LucideIcon,
  PencilLine,
  Shuffle,
} from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { cardClass } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createLesson } from "../../admin-actions";
import { createCopy as t } from "../../messages";

/** The whole card is the target: the action's `::after` covers it. */
const cover =
  "after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:outline-none";

const actionClass =
  "inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary text-sm group-hover:underline";

function Choice({
  icon: Icon,
  tone,
  title,
  body,
  badge,
  children,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  body: string;
  badge?: React.ReactNode;
  /** The card's one action (a link or a submit button), stretched over it. */
  children: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        cardClass,
        "group relative flex flex-col gap-3 p-5 transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/40 hover:border-primary/60 sm:p-6",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className={cn(
            "flex size-12 items-center justify-center rounded-md [&_svg]:size-6",
            tone,
          )}
        >
          <Icon strokeWidth={2} />
        </span>
        {badge}
      </div>
      <h2 className="heading-section">{title}</h2>
      <p className="flex-1 text-muted-foreground text-sm">{body}</p>
      {children}
    </li>
  );
}

/**
 * `/admin/lessons/create` (S5-07, Azota-style): three ways to start a
 * lesson. "Tự soạn" creates the empty draft at once; the other two open
 * their panel on the same page (`?mode=`).
 */
export function CreateChoices({ aiEnabled }: { aiEnabled: boolean }) {
  return (
    <ul aria-label={t.choicesLabel} className="grid gap-4 md:grid-cols-3">
      <Choice
        icon={PencilLine}
        tone="bg-accent-soft text-accent-text"
        title={t.manual.title}
        body={t.manual.body}
      >
        <form action={createLesson}>
          <button type="submit" className={cn(actionClass, cover)}>
            {t.manual.action}
            <ArrowRight aria-hidden className="size-4" />
          </button>
        </form>
      </Choice>
      <Choice
        icon={FileUp}
        tone="bg-primary-soft text-primary"
        title={t.file.title}
        body={t.file.body}
        badge={
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 font-semibold text-xs",
              aiEnabled
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {aiEnabled ? t.file.badge : t.aiOff}
          </span>
        }
      >
        <Link
          href="/admin/lessons/create?mode=file"
          prefetch={false}
          className={cn(actionClass, cover)}
        >
          {t.file.action}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </Choice>
      <Choice
        icon={Shuffle}
        tone="bg-success-soft text-success-text"
        title={t.compose.title}
        body={t.compose.body}
      >
        <Link
          href="/admin/lessons/create?mode=compose"
          prefetch={false}
          className={cn(actionClass, cover)}
        >
          {t.compose.action}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </Choice>
    </ul>
  );
}
