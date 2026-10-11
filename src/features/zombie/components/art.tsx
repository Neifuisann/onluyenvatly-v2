/**
 * The game's characters and props (B-11). Each one shows its generated image
 * when `assets.ts` lists it, or a flat drawn stand-in in the same style:
 * thick ink outlines, red, bone cream, slate. Decorative: the lanes carry
 * the accessible names.
 */
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import {
  type ArtName,
  artUrl,
  type HeroPose,
  type ZombieKind,
  type ZombiePose,
} from "../assets";

const INK = "var(--zb-ink)";
const line = {
  stroke: INK,
  strokeWidth: 5,
  strokeLinejoin: "round",
  strokeLinecap: "round",
} as const;

function Img({
  name,
  className,
  style,
}: {
  name: ArtName;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}) {
  const src = artUrl(name);
  if (!src) return null;
  return (
    // biome-ignore lint/performance/noImgElement: tiny static sprites, no optimizer round trip
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      className={className}
      style={style}
    />
  );
}

export function Hero({
  pose,
  className,
}: {
  pose: HeroPose;
  className?: string | undefined;
}) {
  if (artUrl(`hero-${pose}`))
    return <Img name={`hero-${pose}`} className={className} />;
  const raised = pose === "aim" || pose === "shoot";
  const lean =
    pose === "shoot"
      ? "rotate(-6 100 170)"
      : pose === "hurt"
        ? "rotate(-10 100 175) translate(-6 0)"
        : pose === "lose"
          ? "translate(0 34) rotate(-4 100 170)"
          : "";
  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      className={className}
      overflow="visible"
    >
      <g transform={lean}>
        {/* Legs: black leggings with a red stripe, chunky sneakers. */}
        {pose === "lose" ? (
          <g {...line}>
            <path d="M84 150 L142 156" strokeWidth={20} stroke={INK} />
            <path d="M88 152 L140 158" strokeWidth={9} stroke={INK} />
            <rect
              x={138}
              y={145}
              width={26}
              height={18}
              rx={7}
              fill="var(--zb-cream)"
            />
          </g>
        ) : (
          <g {...line}>
            <path d="M88 130 L80 178" fill="none" strokeWidth={14} />
            <path d="M108 130 L120 178" fill="none" strokeWidth={14} />
            <path
              d="M108 132 L119 172"
              fill="none"
              stroke="var(--zb-red)"
              strokeWidth={3}
            />
            <rect
              x={64}
              y={172}
              width={30}
              height={18}
              rx={7}
              fill="var(--zb-cream)"
            />
            <rect
              x={110}
              y={172}
              width={32}
              height={18}
              rx={7}
              fill="var(--zb-cream)"
            />
            <path d="M68 184 H92 M114 184 H140" stroke="var(--zb-red)" />
          </g>
        )}
        {/* Shorts and shirt. */}
        <path
          d="M78 112 L122 112 L126 140 L104 140 L100 128 L96 140 L74 140 Z"
          fill="var(--zb-slate)"
          {...line}
        />
        <path
          d="M76 70 Q100 62 124 70 L126 116 L74 116 Z"
          fill="var(--zb-cream)"
          {...line}
        />
        <path
          d="M100 72 L94 82 L100 106 L106 82 Z"
          fill="var(--zb-red)"
          {...line}
          strokeWidth={3}
        />
        {/* Back arm. */}
        {pose === "win" ? (
          <path
            d="M120 78 L140 52 M140 52 l-4 -12 M140 52 l8 -10"
            fill="none"
            {...line}
            strokeWidth={8}
            stroke="var(--zb-paper)"
          />
        ) : null}
        {/* Head: cap, hair, pigtails, face. */}
        <g transform={pose === "hurt" ? "rotate(-8 100 50)" : ""}>
          <path
            d="M70 46 Q66 70 76 76 M128 46 Q134 68 126 76"
            fill="none"
            {...line}
            strokeWidth={9}
          />
          <circle cx={72} cy={72} r={6} fill="var(--zb-red)" {...line} />
          <circle cx={128} cy={72} r={6} fill="var(--zb-red)" {...line} />
          <ellipse
            cx={100}
            cy={50}
            rx={27}
            ry={25}
            fill="var(--zb-paper)"
            {...line}
          />
          <path d="M74 44 Q100 30 126 44 L126 52 Q100 42 74 52 Z" fill={INK} />
          <path
            d="M72 40 Q100 14 128 38 L150 40 Q152 46 128 46 Q100 40 72 46 Z"
            fill="var(--zb-red)"
            {...line}
          />
          {pose === "lose" ? (
            <g fill="none" {...line} strokeWidth={3}>
              <path d="M104 52 a4 4 0 1 1 6 3 a7 7 0 1 1 -9 -6" />
              <path d="M116 52 a4 4 0 1 1 6 3" />
            </g>
          ) : pose === "hurt" || pose === "shoot" ? (
            <path
              d="M106 50 l8 3 M116 50 l8 3"
              fill="none"
              {...line}
              strokeWidth={4}
            />
          ) : (
            <g>
              <ellipse cx={110} cy={52} rx={3.5} ry={5} fill="var(--zb-red)" />
              <ellipse cx={121} cy={52} rx={3.5} ry={5} fill="var(--zb-red)" />
            </g>
          )}
          {pose === "shoot" || pose === "win" ? (
            <path
              d="M110 63 q6 6 12 0 z"
              fill="var(--zb-red-deep)"
              {...line}
              strokeWidth={3}
            />
          ) : (
            <path d="M112 64 h8" {...line} strokeWidth={3} />
          )}
          <rect
            x={88}
            y={56}
            width={8}
            height={5}
            rx={1.5}
            fill="var(--zb-cream)"
            {...line}
            strokeWidth={2}
          />
          {pose === "hurt" && (
            <path
              d="M134 30 q6 8 0 12 q-6 -4 0 -12z"
              fill="var(--zb-cream)"
              {...line}
              strokeWidth={3}
            />
          )}
        </g>
        {/* The ink blaster and the front arm. */}
        <g
          transform={
            raised
              ? "translate(4 -10)"
              : pose === "win"
                ? "rotate(-60 96 92) translate(0 -6)"
                : pose === "hurt" || pose === "lose"
                  ? "rotate(28 96 100) translate(0 12)"
                  : "rotate(14 96 100)"
          }
        >
          <path
            d="M84 82 L104 98"
            fill="none"
            {...line}
            strokeWidth={10}
            stroke="var(--zb-paper)"
          />
          <rect
            x={96}
            y={88}
            width={60}
            height={20}
            rx={9}
            fill="var(--zb-cream)"
            {...line}
          />
          <rect
            x={104}
            y={74}
            width={30}
            height={16}
            rx={7}
            fill="var(--zb-red)"
            {...line}
          />
          <rect
            x={154}
            y={92}
            width={16}
            height={12}
            rx={3}
            fill={INK}
            {...line}
          />
          <path
            d="M108 106 l-6 16 h12 l4 -14"
            fill="var(--zb-cream)"
            {...line}
          />
        </g>
      </g>
    </svg>
  );
}

/** Shirt, extras and trousers per zombie kind, like the sheet. */
const OUTFIT: Record<ZombieKind, { shirt: string; legs: string }> = {
  1: { shirt: "var(--zb-cream)", legs: "var(--zb-slate-deep)" },
  2: { shirt: "var(--zb-cream)", legs: "var(--zb-slate)" },
  3: { shirt: "var(--zb-paper)", legs: "var(--zb-slate-deep)" },
};

export function Zombie({
  kind,
  pose,
  className,
}: {
  kind: ZombieKind;
  pose: ZombiePose;
  className?: string | undefined;
}) {
  const name = `zombie-${kind}-${pose}` as const;
  if (artUrl(name)) return <Img name={name} className={className} />;
  const { shirt, legs } = OUTFIT[kind];
  const hit = pose === "hit";
  return (
    <svg
      viewBox="0 0 160 200"
      aria-hidden="true"
      className={className}
      overflow="visible"
    >
      <g transform={hit ? "rotate(18 80 190)" : ""}>
        {/* Legs, one shuffling forward. */}
        <g {...line}>
          <path
            d="M70 136 L58 182"
            fill="none"
            strokeWidth={13}
            stroke={legs}
          />
          <path
            d="M92 136 L102 182"
            fill="none"
            strokeWidth={13}
            stroke={legs}
          />
          <path
            d="M70 136 L58 182 M92 136 L102 182"
            fill="none"
            strokeWidth={3}
          />
          <ellipse cx={52} cy={186} rx={14} ry={7} fill={INK} />
          <ellipse
            cx={104}
            cy={186}
            rx={13}
            ry={7}
            fill={kind === 3 ? "var(--zb-pink)" : "var(--zb-skin)"}
          />
        </g>
        {/* Torso: ragged shirt with red patches. */}
        <path
          d={
            kind === 3
              ? "M56 76 Q80 68 104 76 L112 150 L98 144 L90 152 L80 144 L70 152 L60 144 L48 150 Z"
              : "M58 76 Q80 68 102 76 L106 138 L94 132 L86 140 L76 132 L66 140 L54 136 Z"
          }
          fill={shirt}
          {...line}
        />
        <rect
          x={84}
          y={96}
          width={12}
          height={10}
          fill="var(--zb-red)"
          {...line}
          strokeWidth={2.5}
          transform="rotate(12 90 101)"
        />
        {kind === 2 && (
          <path
            d="M80 78 L75 88 L80 116 L85 88 Z"
            fill="var(--zb-red)"
            {...line}
            strokeWidth={3}
          />
        )}
        {kind === 1 && (
          <rect
            x={96}
            y={80}
            width={22}
            height={40}
            rx={8}
            fill="var(--zb-slate)"
            {...line}
          />
        )}
        {/* Head. */}
        <g transform={hit ? "rotate(14 80 46)" : "rotate(-6 80 46)"}>
          <ellipse
            cx={80}
            cy={46}
            rx={26}
            ry={27}
            fill="var(--zb-skin)"
            {...line}
          />
          {kind === 3 ? (
            <>
              <circle cx={84} cy={16} r={9} fill={INK} />
              <path
                d="M56 36 Q80 18 104 36 L104 30 Q80 10 56 30 Z"
                fill={INK}
              />
              <rect
                x={60}
                y={22}
                width={40}
                height={12}
                rx={6}
                fill="var(--zb-cream)"
                {...line}
                strokeWidth={3}
              />
            </>
          ) : (
            <path
              d="M54 40 L58 24 L66 30 L70 18 L80 26 L88 16 L94 28 L104 24 L106 40 Q80 28 54 40 Z"
              fill={INK}
              {...line}
              strokeWidth={3}
            />
          )}
          {hit ? (
            <g {...line} strokeWidth={3.5}>
              <path d="M60 44 l8 8 m0 -8 l-8 8 M76 44 l8 8 m0 -8 l-8 8" />
              <path
                d="M70 62 q4 10 8 0"
                fill="var(--zb-red)"
                strokeWidth={2.5}
              />
            </g>
          ) : (
            <g>
              <ellipse
                cx={64}
                cy={47}
                rx={7}
                ry={6}
                fill="var(--zb-cream)"
                {...line}
                strokeWidth={2.5}
              />
              <ellipse
                cx={81}
                cy={47}
                rx={7}
                ry={6}
                fill="var(--zb-cream)"
                {...line}
                strokeWidth={2.5}
              />
              <circle cx={62} cy={48} r={2} fill={INK} />
              <circle cx={79} cy={48} r={2} fill={INK} />
              <path d="M57 41 h14 M74 41 h14" {...line} strokeWidth={3} />
              {kind === 2 && (
                <path
                  d="M56 46 h16 M73 46 h16"
                  {...line}
                  strokeWidth={2}
                  fill="none"
                />
              )}
              <path
                d="M64 62 q8 -4 14 2"
                fill="none"
                {...line}
                strokeWidth={3}
              />
            </g>
          )}
        </g>
        {/* Arms reaching forward to hold the sign. */}
        <path
          d={hit ? "M62 86 L40 58" : "M62 86 L30 100"}
          fill="none"
          {...line}
          strokeWidth={11}
          stroke="var(--zb-skin-shade)"
        />
        <path
          d={hit ? "M62 86 L40 58" : "M62 86 L30 100"}
          fill="none"
          {...line}
          strokeWidth={3}
        />
      </g>
    </svg>
  );
}

/** The barricade: stacked desks and warning tape; tiles down the lanes. */
export function Barricade({ className }: { className?: string }) {
  const src = artUrl("barricade");
  if (src)
    return (
      <div
        aria-hidden
        className={className}
        style={{
          backgroundImage: `url(${src})`,
          backgroundSize: "100% auto",
          backgroundRepeat: "repeat-y",
        }}
      />
    );
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 60 200"
      preserveAspectRatio="none"
    >
      <defs>
        <pattern
          id="zb-barricade"
          width="60"
          height="100"
          patternUnits="userSpaceOnUse"
        >
          <rect
            x={8}
            y={4}
            width={44}
            height={40}
            rx={3}
            fill="var(--zb-paper)"
            stroke={INK}
            strokeWidth={4}
          />
          <path d="M14 14 h32 M14 24 h32" stroke={INK} strokeWidth={2.5} />
          <rect
            x={4}
            y={50}
            width={52}
            height={46}
            rx={3}
            fill="var(--zb-slate)"
            stroke={INK}
            strokeWidth={4}
          />
          <path
            d="M0 64 L60 84"
            stroke="var(--zb-red)"
            strokeWidth={9}
            strokeDasharray="10 8"
          />
          <path d="M0 64 L60 84" stroke={INK} strokeWidth={1.5} fill="none" />
        </pattern>
      </defs>
      <rect width="60" height="200" fill="url(#zb-barricade)" />
    </svg>
  );
}

/** The flying blob of ink. */
export function InkShot({ className }: { className?: string }) {
  if (artUrl("ink-shot")) return <Img name="ink-shot" className={className} />;
  return (
    <svg aria-hidden="true" viewBox="0 0 80 40" className={className}>
      <path
        d="M78 20 a14 14 0 0 1 -26 8 Q30 30 8 24 Q24 20 8 14 Q30 10 52 12 a14 14 0 0 1 26 8z"
        fill="var(--zb-red)"
        stroke={INK}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <ellipse cx={64} cy={15} rx={5} ry={3} fill="var(--zb-cream)" />
      <circle cx={3} cy={19} r={2.5} fill="var(--zb-red)" />
    </svg>
  );
}

/** A red ink splat for hits. */
export function Splat({
  variant = 1,
  className,
}: {
  variant?: 1 | 2;
  className?: string | undefined;
}) {
  if (artUrl(`splat-${variant}`))
    return <Img name={`splat-${variant}`} className={className} />;
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className={className}>
      <path
        d="M50 14 Q58 30 70 20 Q66 36 86 34 Q72 46 88 60 Q70 60 74 80 Q60 68 50 86 Q42 68 26 80 Q30 62 12 60 Q28 48 14 34 Q34 38 30 20 Q42 30 50 14 Z"
        fill="var(--zb-red)"
        stroke={INK}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <circle cx={92} cy={20} r={4} fill="var(--zb-red)" />
      <circle cx={8} cy={84} r={3} fill="var(--zb-red)" />
      <circle cx={84} cy={90} r={2.5} fill="var(--zb-red)" />
    </svg>
  );
}

/** One life in the HUD: a toy ink cartridge, full or spent. */
export function Cartridge({
  full,
  className,
}: {
  full: boolean;
  className?: string | undefined;
}) {
  const name = full ? "ammo" : "ammo-empty";
  if (artUrl(name))
    return <Img name={name} className={cn("object-contain", className)} />;
  return (
    <svg aria-hidden="true" viewBox="0 0 40 20" className={className}>
      <rect
        x={2}
        y={3}
        width={30}
        height={14}
        rx={5}
        fill="var(--zb-cream)"
        stroke={INK}
        strokeWidth={2.5}
      />
      <rect
        x={7}
        y={6.5}
        width={18}
        height={7}
        rx={2}
        fill={full ? "var(--zb-red)" : "var(--zb-slate)"}
      />
      <rect
        x={31}
        y={5}
        width={7}
        height={10}
        rx={2}
        fill={INK}
        stroke={INK}
        strokeWidth={2}
      />
    </svg>
  );
}

/** What a cleared zombie bursts into. */
export function PaperBurst({ className }: { className?: string }) {
  return <Img name="paper-bits" className={className} />;
}
