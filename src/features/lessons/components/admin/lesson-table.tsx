"use client";

import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChartColumn,
  Copy,
  GripVertical,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { Button } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import type { Result } from "@/lib/result";
import { cn } from "@/lib/utils";
import {
  archive,
  deleteLesson,
  duplicate,
  reorder,
  restore,
} from "../../admin-actions";
import {
  type AdminSort,
  moveItem,
  type SortDir,
  withPageOrder,
} from "../../domain/admin-list";
import { lessonTopic } from "../../domain/topic";
import { statsCopy, adminLessonsCopy as t } from "../../messages";
import { TopicGlyph } from "../topic-glyph";
import { LessonStatusBadge } from "./lesson-status-badge";

export type LessonTableRow = {
  id: number;
  title: string;
  status: "draft" | "published" | "archived";
  grade: number | null;
  chapter: string | null;
  questionCount: number;
  attemptCount: number;
  hasDraft: boolean;
  /** Pre-formatted on the server (`dd/mm/yyyy hh:mm`). */
  created: string;
  updated: string;
};

type SortableColumn = "title" | "created" | "updated";

export type TableSort = {
  by: AdminSort;
  dir: SortDir;
  /** Where each column's arrow leads (built on the server with the filters). */
  hrefs: Record<SortableColumn, string>;
};

/** `dd/mm/yyyy hh:mm` on two lines: the date, then a quieter time. */
function DateCell({ value }: { value: string }) {
  const [date, time] = value.split(" ");
  return (
    <>
      <span className="block text-foreground">{date}</span>
      <span className="block text-muted-foreground text-xs">{time}</span>
    </>
  );
}

/**
 * `/admin/lessons` table (S5-01, S5-07), one page at a time, Azota-style:
 * one column per fact (status, questions, attempts, dates) and arrows on the
 * sortable headers; on phones the facts fold under the title. In the manual
 * order (`order` given), reorder by dragging
 * the handle (mouse or touch, pointer events) within the page, or with ↑/↓
 * on the focused handle, which also crosses to the neighbouring page. Every
 * move sends the full order (`order`) and is rolled back if refused.
 */
export function LessonTable({
  rows,
  order: fullOrder,
  offset,
  sort,
}: {
  rows: LessonTableRow[];
  sort: TableSort;
  /** The whole list's ids in order; `null` when filtered (no reordering). */
  order: number[] | null;
  /** Index of `rows[0]` in `order`. */
  offset: number;
}) {
  const reorderable = fullOrder !== null;
  const [order, setOrder] = useState(rows);
  const [message, setMessage] = useState<{ text: string; error: boolean }>();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<LessonTableRow | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>());
  const dragStart = useRef<number[]>([]);

  // Fresh server data (after refresh()) replaces the local order.
  useEffect(() => setOrder(rows), [rows]);

  const run = <T,>(
    action: () => Promise<Result<T>>,
    success: (data: T) => string,
    onError?: () => void,
  ) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) setMessage({ text: success(result.data), error: false });
      else {
        onError?.();
        setMessage({ text: result.message, error: true });
      }
    });

  /** Saves `ids` (the full order) and announces where `moved` landed. */
  const save = (ids: number[], moved: LessonTableRow) => {
    run(
      () => reorder({ ids }),
      () => t.moved(moved.title, ids.indexOf(moved.id) + 1, ids.length),
      () => setOrder(rows),
    );
  };

  const onHandleKey = (e: KeyboardEvent, index: number) => {
    const delta = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!delta || !fullOrder) return;
    e.preventDefault();
    const row = order[index];
    const from = offset + index;
    const to = from + delta;
    if (!row || to < 0 || to >= fullOrder.length || pending) return;
    const local = index + delta;
    if (local >= 0 && local < order.length) {
      const next = moveItem(order, index, local);
      setOrder(next);
      save(
        withPageOrder(
          fullOrder,
          offset,
          next.map((r) => r.id),
        ),
        row,
      );
    } else {
      // Onto the neighbouring page: it leaves this one after the refresh.
      save(moveItem(fullOrder, from, to), row);
    }
  };

  const onPointerDown = (e: PointerEvent, id: number) => {
    if (pending || e.button !== 0) return;
    e.preventDefault();
    dragStart.current = order.map((r) => r.id);
    setDragId(id);
  };

  // While dragging, follow the pointer on the window: the handle's row moves
  // in the DOM, which would drop a pointer capture on the handle itself.
  const latest = useRef({ order, save, fullOrder, offset });
  latest.current = { order, save, fullOrder, offset };
  useEffect(() => {
    if (dragId === null) return;
    const move = (e: globalThis.PointerEvent) => {
      const current = latest.current.order;
      const from = current.findIndex((r) => r.id === dragId);
      // The first row whose vertical middle is below the pointer is the slot.
      let to = current.length - 1;
      for (const [i, row] of current.entries()) {
        const rect = rowRefs.current.get(row.id)?.getBoundingClientRect();
        if (rect && e.clientY < rect.top + rect.height / 2) {
          to = i > from ? i - 1 : i;
          break;
        }
      }
      if (to !== from) setOrder(moveItem(current, from, to));
    };
    const up = () => {
      const {
        order: current,
        save: commit,
        fullOrder: all,
        offset: at,
      } = latest.current;
      setDragId(null);
      const moved = current.find((r) => r.id === dragId);
      if (all && moved && current.some((r, i) => r.id !== dragStart.current[i]))
        commit(
          withPageOrder(
            all,
            at,
            current.map((r) => r.id),
          ),
          moved,
        );
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragId]);

  const confirmDelete = (row: LessonTableRow) =>
    run(
      () => deleteLesson(row.id),
      (d) => (d.soft ? t.deletedSoft : t.deletedHard),
    );

  return (
    <div className="flex flex-col gap-3">
      <output
        aria-live="polite"
        className={cn(
          "min-h-5 text-sm empty:hidden",
          message?.error ? "text-danger-text" : "text-muted-foreground",
        )}
      >
        {message?.text}
      </output>
      <div className={cn(cardClass, "overflow-hidden")}>
        <table className="w-full border-collapse text-sm">
          <thead className="whitespace-nowrap border-b bg-muted/50 text-left text-muted-foreground text-xs">
            <tr>
              {reorderable && (
                <th scope="col" className="w-11 px-1 py-2.5">
                  <span className="sr-only">{t.columns.order}</span>
                </th>
              )}
              <SortHeader column="title" label={t.columns.title} sort={sort} />
              <th
                scope="col"
                className="hidden px-3 py-2.5 font-semibold md:table-cell"
              >
                {t.columns.status}
              </th>
              <th
                scope="col"
                className="hidden px-3 py-2.5 text-right font-semibold lg:table-cell"
              >
                {t.columns.questions}
              </th>
              <th
                scope="col"
                className="hidden px-3 py-2.5 text-right font-semibold lg:table-cell"
              >
                {t.columns.attempts}
              </th>
              <SortHeader
                column="created"
                label={t.columns.created}
                sort={sort}
                className="hidden xl:table-cell"
              />
              <SortHeader
                column="updated"
                label={t.columns.updated}
                sort={sort}
                className="hidden md:table-cell"
              />
              <th scope="col" className="px-2 py-2.5 text-right">
                <span className="sr-only">{t.columns.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70 dark:divide-border">
            {order.map((row, index) => (
              <tr
                key={row.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(row.id, el);
                  else rowRefs.current.delete(row.id);
                }}
                className={cn(
                  "group/row transition-colors hover:bg-muted/40",
                  dragId === row.id &&
                    "relative z-10 bg-primary-soft shadow-raised hover:bg-primary-soft",
                  row.status === "archived" && "text-muted-foreground",
                )}
              >
                {reorderable && (
                  <td className="py-2 pl-1 align-middle">
                    <button
                      type="button"
                      aria-label={t.dragHandle(row.title)}
                      onKeyDown={(e) => onHandleKey(e, index)}
                      onPointerDown={(e) => onPointerDown(e, row.id)}
                      className="flex size-11 cursor-grab touch-none items-center justify-center rounded-full text-muted-foreground/70 hover:bg-muted hover:text-foreground active:cursor-grabbing"
                    >
                      <GripVertical aria-hidden className="size-5" />
                    </button>
                  </td>
                )}
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <TopicGlyph
                      topic={lessonTopic(row.chapter, row.title)}
                      className={cn(
                        "hidden size-10 shrink-0 rounded-md sm:flex [&_svg]:size-5",
                        row.status === "archived" && "opacity-60",
                      )}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <Link
                        href={`/admin/lessons/${row.id}/edit`}
                        prefetch={false}
                        className="line-clamp-2 break-words font-display font-semibold text-[0.9375rem] text-foreground leading-snug tracking-[-0.01em] hover:text-primary hover:underline"
                      >
                        {row.title}
                      </Link>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
                        <span className="md:hidden">
                          <LessonStatusBadge status={row.status} />
                        </span>
                        {(row.grade || row.chapter) && (
                          <span>
                            {[row.grade && t.grade(row.grade), row.chapter]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                        <span className="num lg:hidden">
                          {t.questions(row.questionCount)} ·{" "}
                          {t.attempts(row.attemptCount)}
                        </span>
                        <span className="num md:hidden">{row.updated}</span>
                      </p>
                    </div>
                  </div>
                </td>
                <td className="hidden px-3 py-3 md:table-cell">
                  <div className="flex flex-col items-start gap-1">
                    <LessonStatusBadge status={row.status} />
                    {row.hasDraft && row.status !== "draft" && (
                      <span className="text-muted-foreground text-xs">
                        {t.hasDraftShort}
                      </span>
                    )}
                  </div>
                </td>
                <td className="num hidden px-3 py-3 text-right lg:table-cell">
                  {row.questionCount}
                </td>
                <td className="num hidden px-3 py-3 text-right lg:table-cell">
                  {row.attemptCount}
                </td>
                <td className="num hidden whitespace-nowrap px-3 py-3 xl:table-cell">
                  <DateCell value={row.created} />
                </td>
                <td className="num hidden whitespace-nowrap px-3 py-3 md:table-cell">
                  <DateCell value={row.updated} />
                </td>
                <td className="py-1.5 pr-2 pl-1">
                  <div className="flex justify-end">
                    <Link
                      href={`/admin/lessons/${row.id}/stats`}
                      prefetch={false}
                      aria-label={statsCopy.linkFor(row.title)}
                      title={statsCopy.linkFor(row.title)}
                      className={iconButtonClass}
                    >
                      <ChartColumn aria-hidden />
                    </Link>
                    <IconButton
                      label={`${t.duplicate}: ${row.title}`}
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => duplicate(row.id),
                          () => t.duplicated,
                        )
                      }
                    >
                      <Copy aria-hidden />
                    </IconButton>
                    {row.status === "archived" ? (
                      <IconButton
                        label={`${t.restore}: ${row.title}`}
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => restore(row.id),
                            () => t.restored,
                          )
                        }
                      >
                        <ArchiveRestore aria-hidden />
                      </IconButton>
                    ) : (
                      <IconButton
                        label={`${t.archive}: ${row.title}`}
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => archive(row.id),
                            () => t.archived,
                          )
                        }
                      >
                        <Archive aria-hidden />
                      </IconButton>
                    )}
                    <IconButton
                      label={`${t.delete}: ${row.title}`}
                      disabled={pending}
                      onClick={() => setConfirm(row)}
                      className="text-danger-text hover:bg-danger-soft"
                    >
                      <Trash2 aria-hidden />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={t.deleteTitle}
        closeLabel={t.close}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              {t.cancel}
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => {
                if (confirm) confirmDelete(confirm);
                setConfirm(null);
              }}
            >
              {t.deleteConfirm}
            </Button>
          </>
        }
      >
        {confirm && (
          <p>
            {confirm.attemptCount > 0
              ? t.deleteSoft(confirm.title, confirm.attemptCount)
              : t.deleteHard(confirm.title)}
          </p>
        )}
      </Dialog>
    </div>
  );
}

const iconButtonClass =
  "flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 [&_svg]:size-[1.125rem]";

function IconButton({
  label,
  className,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(iconButtonClass, className)}
      {...props}
    />
  );
}

/**
 * A sortable column's header: a link with an arrow (↕ while another column
 * sorts, ↑/↓ for the current direction) and `aria-sort` on the cell.
 */
function SortHeader({
  column,
  label,
  sort,
  className,
}: {
  column: SortableColumn;
  label: string;
  sort: TableSort;
  className?: string;
}) {
  const active = sort.by === column;
  const Arrow = !active
    ? ArrowUpDown
    : sort.dir === "asc"
      ? ArrowUp
      : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={
        active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined
      }
      className={cn("px-1.5 py-1 font-semibold", className)}
    >
      <Link
        href={sort.hrefs[column]}
        prefetch={false}
        scroll={false}
        title={t.sortBy(label, active ? sort.dir : null)}
        className={cn(
          "inline-flex min-h-9 items-center gap-1 rounded-full px-1.5 transition-colors hover:bg-muted hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        <Arrow
          aria-hidden
          className={cn("size-3.5", !active && "opacity-60")}
        />
      </Link>
    </th>
  );
}
