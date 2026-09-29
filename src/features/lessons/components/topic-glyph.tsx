import {
  Activity,
  Atom,
  BatteryMedium,
  Cable,
  ClipboardCheck,
  Gauge,
  type LucideIcon,
  Magnet,
  Orbit,
  Rainbow,
  Rocket,
  Thermometer,
  Waves,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Topic } from "../domain/topic";

/** One icon and one tint per topic, so a chapter always looks the same. */
const GLYPHS: Record<Topic, { icon: LucideIcon; tone: string }> = {
  oscillation: { icon: Activity, tone: "bg-primary-soft text-primary" },
  wave: { icon: Waves, tone: "bg-ink text-accent" },
  current: { icon: Cable, tone: "bg-accent-soft text-accent-text" },
  electric: { icon: Zap, tone: "bg-accent-soft text-accent-text" },
  magnetic: { icon: Magnet, tone: "bg-peach text-danger-text" },
  optics: { icon: Rainbow, tone: "bg-ink text-accent" },
  thermal: { icon: Thermometer, tone: "bg-peach text-danger-text" },
  nuclear: { icon: Atom, tone: "bg-success-soft text-success-text" },
  kinematics: { icon: Gauge, tone: "bg-success-soft text-success-text" },
  dynamics: { icon: Rocket, tone: "bg-primary-soft text-primary" },
  energy: { icon: BatteryMedium, tone: "bg-accent-soft text-accent-text" },
  review: { icon: ClipboardCheck, tone: "bg-ink text-accent" },
  general: { icon: Orbit, tone: "bg-primary-soft text-primary" },
};

export function TopicGlyph({
  topic,
  className,
}: {
  topic: Topic;
  className?: string;
}) {
  const { icon: Icon, tone } = GLYPHS[topic];
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-[0.875rem]",
        tone,
        className,
      )}
    >
      <Icon className="size-6" strokeWidth={2} />
    </span>
  );
}
