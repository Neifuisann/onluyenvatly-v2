import { Check, Layers, Repeat, Sparkles, Trophy } from "lucide-react";
import type * as React from "react";
import { Logo } from "@/components/logo";
import { Mascot, type MascotPose } from "@/components/mascot";
import { ThemeToggle } from "@/components/theme-toggle";
import { onboardingCopy as t } from "@/lib/messages";
import { cn } from "@/lib/utils";

const VALUES = [
  { icon: Layers, ...t.values.format },
  { icon: Sparkles, ...t.values.instant },
  { icon: Repeat, ...t.values.review },
  { icon: Trophy, ...t.values.rank },
] as const;

/**
 * The frame of every sign-in/sign-up screen (07 §2 public). Desktop: a navy
 * panel that says what the site is for, next to the form. Phones: the form
 * alone, under the bunny that matches the moment.
 */
export function AuthScreen({
  pose,
  title,
  lead,
  steps,
  children,
}: {
  pose: MascotPose;
  title: string;
  lead?: React.ReactNode;
  /** Registration progress: 1 = sign up, 2 = teacher approves, 3 = practise. */
  steps?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative isolate m-3 hidden flex-col overflow-hidden rounded-2xl bg-ink p-10 text-ink-foreground lg:flex xl:p-14">
        <span
          aria-hidden
          className="-z-10 -top-32 -left-24 absolute size-[28rem] rounded-full bg-primary/35 blur-3xl"
        />
        <span
          aria-hidden
          className="-z-10 -right-24 -bottom-40 absolute size-[26rem] rounded-full bg-accent/15 blur-3xl"
        />
        <Logo className="text-ink-foreground" />
        <div className="mt-auto max-w-md space-y-8">
          <p className="font-bold font-display text-4xl leading-[1.1] tracking-tight xl:text-5xl">
            {t.headline[0]} <span className="text-accent">{t.headline[1]}</span>
          </p>
          <ul className="grid gap-4">
            {VALUES.map(({ icon: Icon, title: vt, body }) => (
              <li key={vt} className="flex gap-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink-foreground/10 text-accent">
                  <Icon aria-hidden className="size-5" strokeWidth={2} />
                </span>
                <span>
                  <span className="block font-semibold">{vt}</span>
                  <span className="block text-ink-muted text-sm">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <Mascot
          pose={pose}
          size={220}
          priority
          className="absolute top-24 right-10 animate-pop xl:right-14"
        />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex h-16 items-center justify-between px-4 sm:px-6">
          <Logo narrow className="lg:invisible" />
          <ThemeToggle />
        </header>
        <main
          id="main"
          className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pt-2 pb-12"
        >
          <Mascot
            pose={pose}
            size={120}
            priority
            className="mb-4 animate-pop self-center lg:hidden"
          />
          {steps && <Steps current={steps} />}
          <div className="mb-7 space-y-2 text-center lg:text-left">
            <h1 className="heading-page">{title}</h1>
            {lead && <p className="text-muted-foreground">{lead}</p>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

/** Where a new student is in "đăng ký → giáo viên duyệt → luyện đề". */
function Steps({ current }: { current: 1 | 2 }) {
  return (
    <ol
      aria-label={t.stepsLabel}
      className="mb-6 flex items-center justify-center gap-2 lg:justify-start"
    >
      {t.steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-2">
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  "h-0.5 w-4 rounded-full sm:w-6",
                  done || active ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 font-semibold text-xs",
                active && "bg-primary-soft text-foreground",
                done && "text-primary",
                !done && !active && "text-muted-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "num flex size-5 items-center justify-center rounded-full text-[0.6875rem]",
                  active || done
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted",
                )}
              >
                {done ? <Check className="size-3" strokeWidth={3} /> : n}
              </span>
              <span className={cn(!active && "max-sm:sr-only")}>{label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
