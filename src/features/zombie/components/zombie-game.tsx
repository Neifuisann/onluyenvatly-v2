"use client";

import {
  ArrowLeft,
  Maximize,
  Minimize,
  RotateCcw,
  Volume2,
  VolumeX,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { ZombieState, ZombieWave } from "@/db/schema";
import type { RunnerQuestion } from "@/features/attempts/components/runner/types";
import { formatScore } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { artUrl, PLAY_ART, zombieKind } from "../assets";
import { livesLeft, summary } from "../domain/engine";
import {
  downLanes,
  laneLetter,
  statementLetter,
  walkProgress,
} from "../domain/view";
import { zombieCopy as t } from "../messages";
import {
  Barricade,
  Cartridge,
  Hero,
  InkShot,
  PaperBurst,
  Splat,
  Zombie,
} from "./art";
import { type Fx, useZombieGame } from "./use-zombie-game";
import s from "./zombie.module.css";

const SHAKE: Keyframe[] = [
  { transform: "none" },
  { transform: "translate(-8px, 3px)" },
  { transform: "translate(7px, -4px)" },
  { transform: "translate(-5px, 2px)" },
  { transform: "translate(3px, -1px)" },
  { transform: "none" },
];

const GROUND = artUrl("ground");
const TITLE = artUrl("title");
/** The floor, dimmed so the lanes and characters read first. */
const GROUND_LAYERS = GROUND
  ? `linear-gradient(color-mix(in oklch, var(--zb-ink) 38%, transparent), color-mix(in oklch, var(--zb-ink) 38%, transparent)), url(${GROUND})`
  : undefined;

type Props = {
  attemptId: string;
  lessonId: number | null;
  title: string;
  /** Aligned with the attempt's items, options in display order. */
  questions: RunnerQuestion[];
  initial: ZombieState;
  serverNow: number;
};

/**
 * "Bắn zombie" (B-11): one wave on screen at a time. The question sits on a
 * paper card in the sky; each answer is a sign held by a zombie walking
 * down its lane toward the barricade. Tapping a sign (or its key) fires.
 */
export function ZombieGame(props: Props) {
  const g = useZombieGame(props);
  const { game, shown, fx } = g;
  const wave = game.waves[shown] as ZombieWave;
  const question = props.questions[wave.i];
  const stageRef = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const exitHref = props.lessonId ? `/lessons/${props.lessonId}` : "/lessons";

  // A miss shakes the stage. Web Animations, so nothing remounts (a key
  // change would reload every sprite mid-effect).
  const badId =
    fx?.wave === shown && (fx.kind === "miss" || fx.kind === "timeout")
      ? fx.id
      : undefined;
  useEffect(() => {
    if (badId === undefined) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    stageRef.current?.animate(SHAKE, { duration: 360, easing: "ease-in-out" });
  }, [badId]);

  // Every pose and effect, fetched once up front: nothing pops in mid-hit.
  useEffect(() => {
    for (const name of PLAY_ART) {
      const url = artUrl(name);
      if (url) new Image().src = url;
    }
  }, []);

  // Leaving the game (any exit: menu, end panel, back button) hands the
  // page back windowed and unlocked. Cleanup also runs when the route is
  // hidden in an <Activity>, not only on unmount.
  useEffect(() => leaveFullscreen, []);

  // The walk: CSS variables set every frame, no React render per frame.
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const el = stageRef.current;
      if (!el || shown !== game.wave || game.over) return;
      const p = walkProgress(game, g.now());
      el.style.setProperty("--walk", String(Math.max(0, p)));
      el.style.setProperty("--enter", String(Math.max(0, -p)));
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [game, shown, g.now]);

  // The countdown and the seconds label: a timer, not frames, so they stay
  // right when the browser stops drawing (a backgrounded or busy tab).
  useEffect(() => {
    let lastCount: number | null = null;
    let lastSec: number | null = null;
    const tick = () => {
      const now = g.now();
      const first = game.wave === 0 && game.waves[0]?.s.length === 0;
      const count =
        game.at !== null && first && now < game.at
          ? Math.ceil((game.at - now) / 1000)
          : null;
      if (count !== lastCount) {
        if (count !== null) g.sound("tick");
        else if (lastCount !== null) g.sound("go");
        lastCount = count;
        setCountdown(count);
      }
      const left =
        game.sec !== null && game.at !== null && now >= game.at
          ? Math.max(0, Math.ceil((game.at + game.sec * 1000 - now) / 1000))
          : null;
      if (left !== lastSec) {
        lastSec = left;
        setSecondsLeft(left);
      }
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [game, g.now, g.sound]);

  const lanes = Array.from({ length: wave.n }, (_, i) => i);
  const down = downLanes(wave);
  const heroLane = g.aim ?? (wave.n - 1) / 2;
  const overrun = wave.e === "timeout";
  const badFx =
    fx && fx.wave === shown && (fx.kind === "miss" || fx.kind === "timeout")
      ? fx
      : null;

  return (
    <div className={s.root}>
      <h1 className="sr-only">
        {t.pageTitle}: {props.title}
      </h1>
      <p aria-live="polite" className="sr-only">
        {g.announce}
      </p>
      <Hud
        title={props.title}
        game={game}
        shown={shown}
        muted={g.muted}
        onMute={g.toggleMute}
        onExit={() => setExitOpen(true)}
        lostId={badFx?.id ?? null}
      />
      <div ref={stageRef} className={s.stage}>
        <Sky>
          {question && (
            <QuestionCard
              key={shown}
              wave={wave}
              waveIndex={shown}
              waves={game.waves.length}
              question={question}
              secondsLeft={secondsLeft}
              timed={game.sec !== null}
            />
          )}
        </Sky>
        <div
          className={cn(s.field, !GROUND && s.halftone, overrun && s.overrun)}
          style={
            {
              "--lanes": wave.n,
              ...(GROUND && { backgroundImage: GROUND_LAYERS }),
            } as CSSProperties
          }
        >
          <div className={s.heroCol}>
            <div
              className={s.hero}
              style={{ top: `${((heroLane + 0.5) / wave.n) * 100}%` }}
            >
              <div
                key={fx?.kind === "shot" ? fx.id : "still"}
                className={cn(fx?.kind === "shot" && s.recoil)}
              >
                <Hero pose={g.pose} className={s.heroArt} />
              </div>
            </div>
          </div>
          <Barricade className={cn(s.barricade, overrun && s.barricadeHit)} />
          {lanes.map((lane) => (
            <Lane
              key={`${shown}-${lane}`}
              lane={lane}
              wave={wave}
              waveIndex={shown}
              question={question}
              down={down.includes(lane)}
              fx={fx}
              disabled={!g.playable || g.pending}
              onFire={() => void g.fire(lane)}
            />
          ))}
          <Effects fx={fx} shown={shown} />
        </div>
        {badFx && (
          <>
            <div className={s.flash} />
            <p className={cn(s.shout, s.shoutBad)} aria-hidden>
              {badFx.kind === "timeout" ? t.timeout : t.miss}
            </p>
            <p className={s.lifeStamp} style={{ top: "60%" }} aria-hidden>
              {t.minusLife}
            </p>
          </>
        )}
        {fx?.kind === "hit" && fx.wave === shown && (
          <p key={fx.id} className={s.shout} aria-hidden>
            {t.hit}
          </p>
        )}
      </div>

      {g.error && (
        <output className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-zb-ink px-4 py-2 font-semibold text-sm text-zb-cream">
          <WifiOff aria-hidden className="size-4" />
          {g.error === "offline" ? t.offline : t.failed}
        </output>
      )}

      {game.at === null && !g.ended && (
        <Intro
          title={props.title}
          game={game}
          pending={g.pending}
          onStart={() => {
            void goLandscape();
            void g.begin();
          }}
        />
      )}
      {countdown !== null && (
        <div className={cn(s.overlay, "bg-transparent!")} aria-hidden>
          <p key={countdown} className={s.count}>
            {countdown}
          </p>
        </div>
      )}
      {g.ended && (
        <EndScreen
          attemptId={props.attemptId}
          exitHref={exitHref}
          game={game}
          result={g.result}
        />
      )}
      <RotatePrompt />
      <ExitDialog
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        attemptId={props.attemptId}
        exitHref={exitHref}
      />
    </div>
  );
}

/**
 * Fullscreen plus a landscape lock, where the browser allows it (Android
 * Chrome); elsewhere it fails quietly and the rotate prompt stays.
 */
async function goLandscape() {
  if (!window.matchMedia("(pointer: coarse)").matches) return;
  try {
    if (!document.fullscreenElement)
      await document.documentElement.requestFullscreen?.();
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (o: "landscape") => Promise<void>;
    };
    await orientation.lock?.("landscape");
  } catch {
    // iOS and desktop browsers: no lock; turning the phone still works.
  }
}

/** Undoes `goLandscape` and the HUD toggle; quiet where unsupported. */
function leaveFullscreen() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    // No lock was held, or the browser has no lock API.
  }
  if (document.fullscreenElement)
    void document.exitFullscreen().catch(() => {});
}

/** Phones held upright see this instead of the game (CSS decides when). */
function RotatePrompt() {
  return (
    <div className={cn(s.rotate, s.halftone)} role="alert">
      <div className={s.phone} aria-hidden />
      <p className={s.title}>{t.rotateTitle}</p>
      <p className="max-w-xs font-semibold text-zb-cream">{t.rotateBody}</p>
      <button
        type="button"
        className={s.ghostButton}
        onClick={() => void goLandscape()}
      >
        <RotateCcw aria-hidden className="size-5" />
        {t.rotateButton}
      </button>
    </div>
  );
}

function Hud({
  title,
  game,
  shown,
  muted,
  onMute,
  onExit,
  lostId,
}: {
  title: string;
  game: ZombieState;
  shown: number;
  muted: boolean;
  onMute: () => void;
  onExit: () => void;
  lostId: number | null;
}) {
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const left = livesLeft(game);
  const done = game.waves.filter((w) => w.e).length;
  return (
    <header className={s.hud}>
      <button type="button" className={s.hudButton} onClick={onExit}>
        <ArrowLeft aria-hidden className="size-4" />
        <span className="max-sm:sr-only">{t.exit}</span>
      </button>
      <p className="hidden min-w-0 flex-1 truncate font-bold font-display text-base md:block">
        {title}
      </p>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3 md:flex-none">
        <ul
          aria-label={t.lives(left, game.lives)}
          className="flex shrink-0 items-center gap-1"
        >
          {Array.from({ length: game.lives }, (_, i) => {
            const full = i < left;
            return (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed slots
                key={i}
                className={cn(!full && i === left && lostId && s.lifeLost)}
              >
                <Cartridge full={full} className="h-4 w-8 sm:h-6 sm:w-12" />
              </li>
            );
          })}
        </ul>
        <div className="grid w-16 shrink-0 gap-1 sm:w-32">
          <p className="num text-right font-bold text-xs">
            {t.wave(Math.min(shown + 1, game.waves.length), game.waves.length)}
          </p>
          <div className={s.progressTrack} aria-hidden>
            <div
              className={s.progressFill}
              style={{ width: `${(done / game.waves.length) * 100}%` }}
            />
          </div>
        </div>
        <button
          type="button"
          className={s.hudButton}
          onClick={onMute}
          aria-pressed={!muted}
          aria-label={muted ? t.soundOn : t.soundOff}
        >
          {muted ? (
            <VolumeX aria-hidden className="size-5" />
          ) : (
            <Volume2 aria-hidden className="size-5" />
          )}
        </button>
        <button
          type="button"
          className={cn(s.hudButton, s.wideOnly)}
          aria-label={t.fullscreen}
          aria-pressed={full}
          onClick={() =>
            document.fullscreenElement
              ? void document.exitFullscreen()
              : void document.documentElement.requestFullscreen?.()
          }
        >
          {full ? (
            <Minimize aria-hidden className="size-5" />
          ) : (
            <Maximize aria-hidden className="size-5" />
          )}
        </button>
      </div>
    </header>
  );
}

function Sky({ children }: { children: ReactNode }) {
  const src = artUrl("bg-sky");
  return (
    <div
      className={cn(s.sky, !src && s.halftone)}
      style={src ? { backgroundImage: `url(${src})` } : undefined}
    >
      {!src && (
        <>
          <div className={s.sun} aria-hidden />
          <svg
            className={s.skyline}
            viewBox="0 0 400 60"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0 60 V34 H14 V20 H30 V30 H44 V12 H58 V28 H70 V22 H86 V36 H98 V16 H112 V8 H120 V16 H130 V30 H150 V18 H168 V26 H180 V10 H196 V30 H214 V22 H226 V34 H244 V14 H262 V24 H276 V6 H284 V24 H300 V32 H318 V18 H334 V28 H350 V12 H366 V30 H382 V20 H400 V60 Z"
              fill="var(--zb-slate)"
            />
            <path
              d="M0 60 V46 H22 V40 H48 V48 H76 V42 H110 V50 H140 V44 H178 V50 H210 V42 H250 V48 H290 V40 H330 V48 H370 V44 H400 V60 Z"
              fill="var(--zb-slate-deep)"
            />
          </svg>
        </>
      )}
      {children}
    </div>
  );
}

function QuestionCard({
  wave,
  waveIndex,
  waves,
  question,
  secondsLeft,
  timed,
}: {
  wave: ZombieWave;
  waveIndex: number;
  waves: number;
  question: RunnerQuestion;
  secondsLeft: number | null;
  timed: boolean;
}) {
  const statement =
    wave.p !== undefined ? question.statements?.[wave.p] : undefined;
  return (
    <section
      aria-label={t.question(wave.i + 1)}
      className={cn(s.card, s.cardEnter)}
    >
      <header className="mb-2 flex items-center gap-2">
        <span className={s.chip}>{t.question(wave.i + 1)}</span>
        <span className="font-semibold text-xs opacity-70">
          {t.wave(waveIndex + 1, waves)}
        </span>
        {timed && secondsLeft !== null && (
          <span
            className={cn(
              "num ml-auto rounded-full border-2 border-zb-ink px-2 font-extrabold text-sm",
              secondsLeft <= 5 && "bg-zb-red text-zb-cream",
            )}
          >
            {secondsLeft}s
          </span>
        )}
      </header>
      <div
        className={cn(
          "break-words",
          statement ? "text-sm opacity-80" : "text-base sm:text-lg",
        )}
      >
        {question.stem}
      </div>
      {statement && wave.p !== undefined && (
        <div className={s.statement}>
          <span className="mr-1 font-extrabold text-zb-red-deep">
            {statementLetter(wave.p)})
          </span>
          {statement}
        </div>
      )}
      {timed && (
        <div className={s.fuse} aria-hidden>
          <div className={s.fuseFill} />
        </div>
      )}
    </section>
  );
}

function Lane({
  lane,
  wave,
  waveIndex,
  question,
  down,
  fx,
  disabled,
  onFire,
}: {
  lane: number;
  wave: ZombieWave;
  waveIndex: number;
  question: RunnerQuestion | undefined;
  down: boolean;
  fx: Fx | null;
  disabled: boolean;
  onFire: () => void;
}) {
  const tf = wave.p !== undefined;
  const letter = laneLetter(wave, lane);
  const content: ReactNode = tf
    ? lane === 0
      ? t.true
      : t.false
    : question?.options?.[lane];
  const hitHere =
    fx?.kind === "hit" && fx.wave === waveIndex && fx.lane === lane;
  const isKey = wave.k === lane;
  const revealed = isKey && (wave.e === "miss" || wave.e === "timeout");
  const cleared = wave.e === "hit" && !isKey && !down;
  const pose = down || hitHere ? "hit" : "walk";
  const labelId = `lane-${waveIndex}-${lane}`;
  return (
    <div
      className={cn(
        s.lane,
        down && s.down,
        revealed && s.key,
        hitHere && s.target,
        cleared && s.cleared,
      )}
      data-lane={lane}
      style={{ "--i": lane } as CSSProperties}
    >
      <span className={s.laneTag} aria-hidden>
        {letter}
      </span>
      <div className={s.group}>
        <button
          type="button"
          className={cn(s.sign, tf && "justify-center")}
          onClick={onFire}
          disabled={disabled || down || wave.e !== undefined}
          aria-labelledby={labelId}
        >
          <span className={s.letter} aria-hidden>
            {letter}
          </span>
          <span
            id={labelId}
            className={cn(
              s.signText,
              tf && "flex-none font-display font-extrabold text-xl",
            )}
          >
            <span className="sr-only">
              {tf ? t.tfLaneLabel(String(content)) : t.laneLabel(letter)}:{" "}
            </span>
            {tf ? <span aria-hidden>{content}</span> : content}
          </span>
          {revealed && (
            <span className={s.stamp} aria-hidden>
              {t.answerWas}
            </span>
          )}
        </button>
        <div className={s.zombie}>
          <Zombie
            kind={zombieKind(waveIndex, lane)}
            pose={pose}
            className={s.zombieArt}
          />
        </div>
      </div>
    </div>
  );
}

/** The ink shot, the splat and the paper burst, placed from the DOM. */
function Effects({ fx, shown }: { fx: Fx | null; shown: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    id: number;
    fromX: number;
    toX: number;
    y: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!fx || fx.wave !== shown || fx.kind === "timeout") return;
    const field = ref.current?.parentElement;
    const lane = field?.querySelector<HTMLElement>(`[data-lane="${fx.lane}"]`);
    const hero = field?.querySelector<HTMLElement>(`.${s.hero}`);
    const sign = lane?.querySelector<HTMLElement>(`.${s.sign}`);
    if (!field || !lane || !hero || !sign) return;
    const f = field.getBoundingClientRect();
    const l = lane.getBoundingClientRect();
    const h = hero.getBoundingClientRect();
    const target = sign.getBoundingClientRect();
    setPos({
      id: fx.id,
      fromX: h.right - f.left - 20,
      toX: target.left - f.left + target.width * 0.4,
      y: l.top - f.top + l.height / 2,
    });
  }, [fx, shown]);

  const vars = pos
    ? ({
        "--from-x": `${pos.fromX}px`,
        "--to-x": `${pos.toX}px`,
        "--y": `${pos.y}px`,
      } as CSSProperties)
    : undefined;
  const at = pos ? { left: pos.toX, top: pos.y } : undefined;
  // Only for the wave on screen: nothing carries over to the next one.
  const fresh = pos && fx && pos.id === fx.id && fx.wave === shown;
  return (
    <div ref={ref} aria-hidden className="pointer-events-none contents">
      {fresh && fx.kind === "shot" && (
        <div key={fx.id} className={s.shot} style={vars}>
          <InkShot />
        </div>
      )}
      {fresh && (fx.kind === "hit" || fx.kind === "miss") && (
        <>
          <div key={`s${fx.id}`} className={s.splat} style={at}>
            <Splat variant={fx.id % 2 === 0 ? 1 : 2} />
          </div>
          {fx.kind === "hit" && (
            <>
              <div
                key={`b${fx.id}`}
                className={s.burst}
                style={
                  {
                    "--bx": `${pos.toX}px`,
                    "--by": `${pos.y}px`,
                  } as CSSProperties
                }
              />
              {artUrl("paper-bits") ? (
                <div
                  key={`p${fx.id}`}
                  className={s.paper}
                  style={{ left: pos.toX, top: pos.y }}
                >
                  <PaperBurst />
                </div>
              ) : (
                <PaperBits key={`p${fx.id}`} x={pos.toX} y={pos.y} />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

const BIT_COLORS = ["var(--zb-cream)", "var(--zb-red)", "var(--zb-slate)"];

function PaperBits({ x, y }: { x: number; y: number }) {
  return (
    <div className={s.bits} style={{ left: x, top: y }}>
      {Array.from({ length: 14 }, (_, i) => {
        const angle = (i / 14) * Math.PI * 2;
        const dist = 60 + ((i * 37) % 70);
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: decorative
            key={i}
            className={s.bit}
            style={
              {
                background: BIT_COLORS[i % 3],
                "--dx": `${Math.cos(angle) * dist}px`,
                "--dy": `${Math.sin(angle) * dist}px`,
                "--r": `${(i * 53) % 360}deg`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

function Intro({
  title,
  game,
  pending,
  onStart,
}: {
  title: string;
  game: ZombieState;
  pending: boolean;
  onStart: () => void;
}) {
  return (
    <div className={cn(s.overlay, s.halftone)}>
      {TITLE && <Backdrop src={TITLE} fit="contain" />}
      <div className={cn(s.poster, TITLE && s.posterCenter)}>
        {!TITLE && <Hero pose="aim" className={s.posterArt} />}
        <section className={s.panel} aria-labelledby="zb-intro-title">
          <p id="zb-intro-title" className={s.title}>
            {t.brand}
          </p>
          <p className="mt-3 font-bold text-lg">{title}</p>
          <p className="mt-1 opacity-80">{t.introLead}</p>
          <ul className="mt-4 grid gap-2 text-sm">
            {[
              ...t.rules,
              game.sec ? t.ruleClock(game.sec) : t.ruleNoClock,
              t.ruleLives(game.lives),
            ].map((rule) => (
              <li key={rule} className="flex gap-2">
                <span aria-hidden className="font-black text-zb-red">
                  ✶
                </span>
                {rule}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs opacity-70 max-sm:hidden">{t.keys}</p>
          <button
            type="button"
            className={cn(s.bigButton, "mt-5 w-full")}
            onClick={onStart}
            disabled={pending}
            // biome-ignore lint/a11y/noAutofocus: the only action on screen
            autoFocus
          >
            {pending ? t.starting : t.start}
          </button>
        </section>
      </div>
    </div>
  );
}

function EndScreen({
  attemptId,
  exitHref,
  game,
  result,
}: {
  attemptId: string;
  exitHref: string;
  game: ZombieState;
  result: { score: number; maxScore: number; score10: number } | undefined;
}) {
  const won = game.over === "won";
  const sum = summary(game);
  const scene = artUrl(won ? "win" : "lose");
  return (
    <div className={cn(s.overlay, s.halftone)}>
      {won &&
        Array.from({ length: 24 }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: decorative
            key={i}
            aria-hidden
            className={s.confetti}
            style={
              {
                left: `${(i * 41) % 100}%`,
                background: BIT_COLORS[i % 3],
                animationDelay: `${(i % 8) * 120}ms`,
                "--dx": `${((i * 29) % 120) - 60}px`,
                "--r": `${(i * 97) % 720}deg`,
              } as CSSProperties
            }
          />
        ))}
      {scene && <Backdrop src={scene} fit="cover" />}
      <div className={cn(s.poster, scene && s.posterEnd)}>
        {!scene && <Hero pose={won ? "win" : "lose"} className={s.posterArt} />}
        <section className={s.panel} aria-labelledby="zb-end-title">
          <h2 id="zb-end-title" className={s.title}>
            {won ? t.won : t.lost}
          </h2>
          <p className="mt-3 opacity-80">{won ? t.wonLead : t.lostLead}</p>
          <dl className="mt-4 grid grid-cols-2 gap-2">
            <div className={cn(s.stat, "col-span-2")}>
              <dt className="font-semibold text-xs opacity-70">{t.score}</dt>
              <dd className="num font-display font-extrabold text-4xl">
                {result ? formatScore(result.score10) : "…"}
                <span className="font-bold text-base opacity-60"> / 10</span>
              </dd>
              {!result && <p className="text-xs">{t.grading}</p>}
            </div>
            <div className={s.stat}>
              <dt className="font-semibold text-xs opacity-70">
                {t.firstShot}
              </dt>
              <dd className="num font-extrabold text-xl">
                {sum.firstShot}/{sum.waves}
              </dd>
            </div>
            <div className={s.stat}>
              <dt className="font-semibold text-xs opacity-70">
                {t.livesLeft}
              </dt>
              <dd className="num font-extrabold text-xl">
                {sum.livesLeft}/{game.lives}
              </dd>
            </div>
          </dl>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link
              href={`/attempts/${attemptId}/result`}
              className={s.bigButton}
              prefetch={false}
            >
              {t.viewResult}
            </Link>
            <Link href={exitHref} className={s.ghostButton} prefetch={false}>
              {t.backToLesson}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function ExitDialog({
  open,
  onClose,
  attemptId,
  exitHref,
}: {
  open: boolean;
  onClose: () => void;
  attemptId: string;
  exitHref: string;
}) {
  const router = useRouter();
  const [ending, setEnding] = useState(false);
  const end = async () => {
    setEnding(true);
    try {
      await fetch(`/api/attempts/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: [],
          flagged: [],
          clientSubmitId: crypto.randomUUID(),
        }),
      });
    } finally {
      router.replace(`/attempts/${attemptId}/result`);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.exitTitle}
      closeLabel={t.close}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t.keepPlaying}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push(exitHref)}
          >
            {t.leaveLater}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => void end()}
            disabled={ending}
          >
            {ending ? t.ending : t.endNow}
          </Button>
        </>
      }
    >
      <p>{t.exitBody}</p>
    </Dialog>
  );
}

/** A full-screen scene behind an intro or end panel. */
function Backdrop({ src, fit }: { src: string; fit: "contain" | "cover" }) {
  return (
    // biome-ignore lint/performance/noImgElement: one static scene, no optimizer round trip
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      className={s.backdrop}
      style={{ objectFit: fit }}
    />
  );
}
