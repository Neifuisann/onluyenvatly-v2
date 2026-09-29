"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { approve, reject } from "../admin-actions";
import { studentsCopy as t } from "../messages";
import { useRun } from "./use-run";

export type PendingRow = {
  id: string;
  fullName: string;
  phone: string | null;
  /** The rest of the line, formatted on the server. */
  details: string;
};

/**
 * The pending queue (S6-01): a checkbox per student, "chọn tất cả", and bulk
 * Duyệt / Từ chối (reject asks first). Fresh server data after each action
 * replaces the rows; the selection keeps only students still listed.
 */
export function PendingList({ rows }: { rows: readonly PendingRow[] }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [confirmReject, setConfirmReject] = useState(false);
  const { pending, message, run } = useRun();
  const allRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ids = new Set(rows.map((r) => r.id));
    setSelected((prev) => {
      const kept = [...prev].filter((id) => ids.has(id));
      return kept.length === prev.size ? prev : new Set(kept);
    });
  }, [rows]);

  const count = selected.size;
  const all = rows.length > 0 && count === rows.length;
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = count > 0 && !all;
  }, [count, all]);

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const ids = () => [...selected];
  const clear = () => setSelected(new Set());

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-surface shadow-card dark:border-border px-3 py-2">
        <label className="flex min-h-11 w-full cursor-pointer items-center gap-3 text-sm sm:w-auto sm:flex-1">
          <input
            ref={allRef}
            type="checkbox"
            className="size-5 accent-primary"
            checked={all}
            onChange={(e) =>
              setSelected(
                e.target.checked ? new Set(rows.map((r) => r.id)) : new Set(),
              )
            }
          />
          <span className="font-medium">{t.selectAll}</span>
          <span className="text-muted-foreground">
            {t.selectedCount(count)}
          </span>
        </label>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            className="flex-1 sm:flex-none"
            disabled={count === 0 || pending}
            onClick={() =>
              run(
                () => approve({ ids: ids() }),
                (d) => t.approved(d.done, d.skipped),
                clear,
              )
            }
          >
            {t.approve}
          </Button>
          <Button
            variant="secondary"
            className="flex-1 sm:flex-none"
            disabled={count === 0 || pending}
            onClick={() => setConfirmReject(true)}
          >
            {t.reject}
          </Button>
        </div>
      </div>

      <output
        aria-live="polite"
        className={cn(
          "min-h-5 text-sm",
          message?.error ? "text-danger-text" : "text-muted-foreground",
        )}
      >
        {message?.text}
      </output>

      <ul
        aria-label={t.pendingListLabel}
        className="divide-y rounded-lg border border-border/70 bg-surface shadow-card dark:border-border"
      >
        {rows.map((r) => (
          <li key={r.id}>
            <label
              className={cn(
                "flex min-h-14 cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted",
                selected.has(r.id) && "bg-primary-soft",
              )}
            >
              <input
                type="checkbox"
                aria-label={t.selectStudent(r.fullName)}
                className="mt-0.5 size-5 shrink-0 accent-primary"
                checked={selected.has(r.id)}
                onChange={(e) => toggle(r.id, e.target.checked)}
              />
              <span className="min-w-0 flex-1">
                <span className="block break-words font-medium">
                  {r.fullName}
                </span>
                <span className="mt-1 block text-muted-foreground text-xs">
                  {[r.phone, r.details].filter(Boolean).join(" · ")}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <Dialog
        open={confirmReject}
        onClose={() => setConfirmReject(false)}
        title={t.rejectTitle}
        closeLabel={t.close}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmReject(false)}>
              {t.cancel}
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => {
                setConfirmReject(false);
                run(
                  () => reject({ ids: ids() }),
                  (d) => t.rejected(d.done, d.skipped),
                  clear,
                );
              }}
            >
              {t.rejectConfirm}
            </Button>
          </>
        }
      >
        <p>{t.rejectBody(count)}</p>
      </Dialog>
    </div>
  );
}
