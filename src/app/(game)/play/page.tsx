import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Mascot } from "@/components/mascot";
import { Button } from "@/components/ui/button";
import { requireStudent } from "@/features/auth/guards";
import { StageBar } from "@/features/games/components/stage";
import { PinSchema } from "@/features/games/domain/rules";
import { gameCopy } from "@/features/games/messages";

const t = gameCopy.play;

export const metadata: Metadata = {
  title: t.pageTitle,
  robots: { index: false, follow: false },
};

/**
 * `/play` (B-05): type the PIN from the board. A plain GET form, so it works
 * before any JavaScript loads; a valid PIN goes to `/play/[pin]`.
 */
export default async function PlayEntryPage({
  searchParams,
}: PageProps<"/play">) {
  await requireStudent();
  const raw = (await searchParams).pin;
  const typed = typeof raw === "string" ? raw.replace(/\s/g, "") : null;
  if (typed !== null) {
    const pin = PinSchema.safeParse(typed);
    if (pin.success) redirect(`/play/${pin.data}`);
  }
  const invalid = typed !== null;
  return (
    <div className="flex min-h-dvh flex-col">
      <StageBar title={t.pageTitle} />
      <main className="mx-auto flex w-full max-w-sm flex-1 animate-rise flex-col items-center justify-center gap-6 px-4 pb-16 text-center">
        <Mascot pose="rocket" size={140} priority />
        <div className="space-y-2">
          <h1 className="font-bold font-display text-3xl">{t.enterTitle}</h1>
          <p className="text-ink-muted">{t.enterLead}</p>
        </div>
        <form method="get" action="/play" className="grid w-full gap-3">
          <label htmlFor="pin" className="sr-only">
            {t.pinLabel}
          </label>
          <input
            id="pin"
            name="pin"
            required
            autoFocus
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            defaultValue={typed ?? ""}
            placeholder={t.pinPlaceholder}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? "pin-error" : undefined}
            className="num h-18 w-full rounded-xl border-2 border-transparent bg-ink-foreground text-center font-bold font-display text-4xl text-ink tracking-[0.3em] placeholder:text-ink/40 focus-visible:border-accent focus-visible:outline-none aria-invalid:border-danger"
          />
          {invalid && (
            <p id="pin-error" role="alert" className="text-accent text-sm">
              {t.badPin}
            </p>
          )}
          <Button type="submit" size="lg" className="h-14 text-lg">
            {t.enter}
          </Button>
        </form>
      </main>
    </div>
  );
}
