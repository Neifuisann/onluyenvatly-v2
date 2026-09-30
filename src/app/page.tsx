import {
  ArrowRight,
  Check,
  HardDrive,
  Layers,
  Repeat,
  Sparkles,
  Timer,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { Mascot, type MascotPose } from "@/components/mascot";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { buttonVariants } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { TopicGlyph } from "@/features/lessons/components/topic-glyph";
import type { Topic } from "@/features/lessons/domain/topic";
import { onboardingCopy, landingCopy as t } from "@/lib/messages";
import { cn } from "@/lib/utils";

const FEATURES: {
  pose: MascotPose;
  icon: typeof Layers;
  copy: { title: string; body: string };
}[] = [
  { pose: "laptop", icon: Layers, copy: onboardingCopy.values.format },
  { pose: "idea", icon: Sparkles, copy: onboardingCopy.values.instant },
  { pose: "studying", icon: Repeat, copy: onboardingCopy.values.review },
  { pose: "graph", icon: Trophy, copy: onboardingCopy.values.rank },
];

/**
 * Public landing page (S8-01): static, no database, no client JavaScript of
 * its own. Everything on it is something the site does today.
 */
export default function Home() {
  return (
    <>
      <PublicHeader />
      <main id="main" className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <Topics />
        <Closing />
      </main>
      <PublicFooter />
    </>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <span
        aria-hidden
        className="-z-10 -top-40 absolute left-1/2 size-[44rem] -translate-x-1/2 rounded-full bg-primary-soft blur-3xl dark:bg-primary/15"
      />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-16 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:pb-24">
        <div className="animate-rise space-y-6 text-center lg:text-left">
          <p className="eyebrow text-primary">{t.eyebrow}</p>
          <h1 className="font-bold font-display text-[2.5rem] leading-[1.05] tracking-tight sm:text-6xl">
            <span className="block">{onboardingCopy.headline[0]}</span>
            <span className="block text-primary">
              {onboardingCopy.headline[1]}
            </span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground lg:mx-0">
            {t.lead}
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Link
              href="/register"
              className={buttonVariants({ size: "lg", className: "h-13 px-7" })}
            >
              {t.ctaPrimary}
              <ArrowRight aria-hidden />
            </Link>
            <Link
              href="/login"
              className={buttonVariants({
                variant: "secondary",
                size: "lg",
                className: "h-13 px-7",
              })}
            >
              {t.ctaSecondary}
            </Link>
          </div>
        </div>
        <div className="mx-auto w-full max-w-md">
          <QuestionPreview />
        </div>
      </div>
    </section>
  );
}

/** A real-looking runner card (HTML, not a screenshot): what taking a test feels like. */
function QuestionPreview() {
  const p = t.preview;
  return (
    <figure
      aria-label={p.label}
      className={cn(
        cardClass,
        "rotate-[-1.5deg] space-y-4 p-5 shadow-popover sm:p-6",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-ink px-3 py-1 font-bold font-display text-ink-foreground text-sm">
          {p.question}
        </span>
        <span className="text-muted-foreground text-sm">{p.type}</span>
        <span className="num ml-auto inline-flex h-8 items-center gap-1.5 rounded-full bg-muted px-3 font-display font-semibold text-sm">
          <Timer aria-hidden className="size-4" />
          {p.timer}
        </span>
      </div>
      <p className="text-[1.0625rem] leading-relaxed">{p.stem}</p>
      <ul className="grid gap-2">
        {p.options.map((option, i) => {
          const on = i === 1;
          return (
            <li
              key={option}
              className={cn(
                "flex items-center gap-3 rounded-lg border-2 px-3 py-2.5",
                on ? "border-primary bg-primary-soft" : "border-border",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-8 items-center justify-center rounded-full font-bold font-display text-sm",
                  on ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {on ? <Check className="size-4" strokeWidth={3} /> : "ABCD"[i]}
              </span>
              {option}
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-1.5 text-success-text text-xs">
          <HardDrive aria-hidden className="size-3.5" />
          {p.saved}
        </p>
        <Mascot pose="rocket" size={80} priority className="animate-pop" />
      </div>
    </figure>
  );
}

function Features() {
  return (
    <section
      aria-labelledby="features-heading"
      className="mx-auto max-w-6xl px-4 py-16 sm:px-6"
    >
      <h2
        id="features-heading"
        className="heading-page mb-10 text-center sm:text-[2.5rem]"
      >
        {t.featuresTitle}
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ pose, icon: Icon, copy }) => (
          <li
            key={copy.title}
            className={cn(
              cardClass,
              "flex items-center gap-4 overflow-hidden p-6 sm:p-7",
            )}
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Icon
                aria-hidden
                className="size-6 text-primary"
                strokeWidth={2}
              />
              <h3 className="heading-section">{copy.title}</h3>
              <p className="text-muted-foreground">{copy.body}</p>
            </div>
            <Mascot
              pose={pose}
              size={120}
              className="w-24 shrink-0 sm:w-[120px]"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function HowItWorks() {
  return (
    <section
      aria-labelledby="how-heading"
      className="mx-auto max-w-6xl px-4 py-16 sm:px-6"
    >
      <h2
        id="how-heading"
        className="heading-page mb-10 text-center sm:text-[2.5rem]"
      >
        {t.howTitle}
      </h2>
      <ol className="grid gap-4 md:grid-cols-3">
        {t.howSteps.map((step, i) => (
          <li key={step.title} className={cn(cardClass, "space-y-3 p-6")}>
            <span className="num flex size-10 items-center justify-center rounded-full bg-primary font-bold font-display text-primary-foreground">
              {i + 1}
            </span>
            <h3 className="heading-section">{step.title}</h3>
            <p className="text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Topics() {
  return (
    <section
      aria-labelledby="topics-heading"
      className="mx-auto max-w-6xl px-4 py-16 sm:px-6"
    >
      <h2
        id="topics-heading"
        className="heading-page mb-10 text-center sm:text-[2.5rem]"
      >
        {t.topicsTitle}
      </h2>
      <ul className="flex flex-wrap justify-center gap-3">
        {(Object.entries(t.topics) as [Topic, string][]).map(
          ([topic, name]) => (
            <li
              key={topic}
              className={cn(
                cardClass,
                "flex items-center gap-3 rounded-full py-2 pr-5 pl-2",
              )}
            >
              <TopicGlyph
                topic={topic}
                className="size-10 rounded-full [&>svg]:size-5"
              />
              <span className="font-semibold">{name}</span>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

function Closing() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-8 pb-20 sm:px-6">
      <div className="relative isolate flex flex-col items-center gap-6 overflow-hidden rounded-2xl bg-ink px-6 py-12 text-center text-ink-foreground sm:flex-row sm:px-12 sm:text-left">
        <span
          aria-hidden
          className="-z-10 -right-20 -bottom-32 absolute size-96 rounded-full bg-primary/35 blur-3xl"
        />
        <Mascot
          pose="teacher"
          size={150}
          className="w-28 shrink-0 sm:w-[150px]"
        />
        <div className="flex-1 space-y-2">
          <h2 className="font-bold font-display text-3xl tracking-tight">
            {t.closingTitle}
          </h2>
          <p className="text-ink-muted">{t.closingBody}</p>
        </div>
        <Link
          href="/register"
          className={buttonVariants({
            variant: "ink",
            size: "lg",
            className: "h-13 px-7",
          })}
        >
          {t.ctaPrimary}
          <ArrowRight aria-hidden />
        </Link>
      </div>
    </section>
  );
}
