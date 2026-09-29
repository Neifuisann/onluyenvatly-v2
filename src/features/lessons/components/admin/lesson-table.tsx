"use client";

import {
  Archive,
  ArchiveRestore,
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
import { moveItem } from "../../domain/admin-list";
import { statsCopy, adminLessonsCopy as t } from "../../messages";

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
  updated: string;
};

const statusClass = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-success/15 text-success-text",
  archived: "bg-warning/25 text-foreground",
} as const;

/**
 * `/admin/lessons` table (S5-01). Reorder by dragging the handle (mouse or
 * touch, pointer events) or with ↑/↓ on the focused handle; every move is
 * saved at once and rolled back if the server refuses it.
 */
export function LessonTable({
  rows,
  reorderable,
}: {
  rows: LessonTableRow[];
  reorderable: boolean;
}) {
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

  const save = (next: LessonTableRow[], moved?: LessonTableRow) => {
    const position = moved ? next.indexOf(moved) + 1 : 0;
    run(
      () => reorder({ ids: next.map((r) => r.id) }),
      () =>
        moved ? t.moved(moved.title, position, next.length) : t.reorderSaved,
      () => setOrder(rows),
    );
  };

  const onHandleKey = (e: KeyboardEvent, index: number) => {
    const delta = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!delta) return;
    e.preventDefault();
    const target = index + delta;
    if (target < 0 || target >= order.length || pending) return;
    const next = moveItem(order, index, target);
    setOrder(next);
    save(next, order[index]);
  };

  const onPointerDown = (e: PointerEvent, id: number) => {
    if (pending || e.button !== 0) return;
    e.preventDefault();
    dragStart.current = order.map((r) => r.id);
    setDragId(id);
  };

  // While dragging, follow the pointer on the window: the handle's row moves
  // in the DOM, which would drop a pointer capture on the handle itself.
  const latest = useRef({ order, save });
  latest.current = { order, save };
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
      const { order: current, save: commit } = latest.current;
      setDragId(null);
      if (current.some((r, i) => r.id !== dragStart.current[i]))
        commit(
          current,
          current.find((r) => r.id === dragId),
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
      {!reorderable && (
        <p className="text-muted-foreground text-sm">{t.reorderHint}</p>
      )}
      <output
        aria-live="polite"
        className={cn(
          "min-h-5 text-sm",
          message?.error ? "text-danger-text" : "text-muted-foreground",
        )}
      >
        {message?.text}
      </output>
      <div className="overflow-hidden rounded-lg border border-border/70 bg-surface shadow-card dark:border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/60 text-left text-muted-foreground">
            <tr>
              {reorderable && (
                <th scope="col" className="w-11 px-1 py-2">
                  <span className="sr-only">{t.columns.order}</span>
                </th>
              )}
              <th scope="col" className="px-3 py-2 font-medium">
                {t.columns.title}
              </th>
              <th
                scope="col"
                className="hidden px-3 py-2 font-medium md:table-cell"
              >
                {t.columns.updated}
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                <span className="sr-only">{t.columns.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {order.map((row, index) => (
              <tr
                key={row.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(row.id, el);
                  else rowRefs.current.delete(row.id);
                }}
                className={cn(
                  "border-t align-top transition-colors",
                  dragId === row.id && "bg-primary-soft",
                )}
              >
                {reorderable && (
                  <td className="px-1 py-2">
                    <button
                      type="button"
                      aria-label={t.dragHandle(row.title)}
                      onKeyDown={(e) => onHandleKey(e, index)}
                      onPointerDown={(e) => onPointerDown(e, row.id)}
                      className="flex size-11 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
                    >
                      <GripVertical aria-hidden className="size-5" />
                    </button>
                  </td>
                )}
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/lessons/${row.id}/edit`}
                      prefetch={false}
                      className="font-medium hover:underline"
                    >
                      {row.title}
                    </Link>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-medium text-xs",
                        statusClass[row.status],
                      )}
                    >
                      {t.statuses[row.status]}
                    </span>
                    {row.hasDraft && row.status !== "draft" && (
                      <span className="rounded-full border px-2 py-0.5 text-muted-foreground text-xs">
                        {t.hasDraft}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-muted-foreground text-xs">
                    {[
                      row.grade && t.grade(row.grade),
                      row.chapter,
                      t.questions(row.questionCount),
                      t.attempts(row.attemptCount),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    <span className="md:hidden"> · {row.updated}</span>
                    {" · "}
                    <Link
                      href={`/admin/lessons/${row.id}/stats`}
                      prefetch={false}
                      aria-label={statsCopy.linkFor(row.title)}
                      className="font-medium text-primary hover:underline"
                    >
                      {statsCopy.link}
                    </Link>
                  </p>
                </td>
                <td className="hidden whitespace-nowrap px-3 py-3 text-muted-foreground md:table-cell">
                  {row.updated}
                </td>
                <td className="px-2 py-1">
                  <div className="flex justify-end">
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
                      className="text-danger-text"
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
      className={cn(
        "flex size-11 items-center justify-center rounded-md hover:bg-muted disabled:opacity-50 [&_svg]:size-5",
        className,
      )}
      {...props}
    />
  );
}
