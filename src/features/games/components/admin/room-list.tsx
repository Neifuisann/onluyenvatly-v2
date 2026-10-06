import { ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { gameCopy } from "../../messages";
import type { HostRoomItem } from "../../queries";

const t = gameCopy.admin;

const tone = {
  lobby: "bg-accent-soft text-accent-text",
  running: "bg-success-soft text-success-text",
  finished: "bg-muted text-muted-foreground",
} as const;

const dot = {
  lobby: "bg-accent",
  running: "bg-success animate-pulse",
  finished: "bg-muted-foreground/60",
} as const;

/** `/admin/games`: the teacher's latest rooms, newest first. */
export function RoomList({ rooms }: { rooms: HostRoomItem[] }) {
  return (
    <ul aria-label={t.listLabel} className="grid gap-2.5">
      {rooms.map((room) => (
        <li key={room.id}>
          <Link
            href={`/host/${room.id}`}
            prefetch={false}
            className="group flex items-center gap-4 rounded-lg border border-border/70 bg-surface p-4 shadow-card transition-[border-color,box-shadow] hover:border-primary/50 hover:shadow-raised dark:border-border"
          >
            <span className="num hidden w-24 shrink-0 rounded-md bg-ink py-2 text-center font-bold font-display text-ink-foreground text-lg tracking-wide sm:block">
              {room.pin}
            </span>
            <span className="min-w-0 flex-1 space-y-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="truncate font-semibold">{room.title}</span>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold text-xs",
                    tone[room.status],
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("size-1.5 rounded-full", dot[room.status])}
                  />
                  {t.status[room.status]}
                </span>
              </span>
              <span className="num flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm">
                <span className="sm:hidden">{t.pin(room.pin)}</span>
                <span className="inline-flex items-center gap-1">
                  <Users aria-hidden className="size-3.5" />
                  {t.players(room.players)}
                </span>
                <span>{t.questions(room.questionCount)}</span>
                <span>{formatDateTime(room.createdAt)}</span>
              </span>
            </span>
            <ChevronRight
              aria-hidden
              className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            />
            <span className="sr-only">{t.open}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
