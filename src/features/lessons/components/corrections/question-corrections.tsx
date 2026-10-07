"use client";

import { Gift, PenLine, RotateCcw, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { pointsPlan } from "@/features/grading/domain/points";
import { cn } from "@/lib/utils";
import { correctQuestions } from "../../admin-actions";
import { diffCorrections, pointsEditable } from "../../domain/corrections";
import { liveQuestions } from "../../domain/summary";
import { questionsCopy as t } from "../../messages";
import type { LessonConfig, Question } from "../../schema";
import { questionTexts, TexProvider } from "../editor/preview-math";
import { PreviewQuestion } from "../editor/preview-question";

const iconButton =
  "flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.125rem]";

/**
 * The published version, question by question (B-10, Azota's "Sửa đề"):
 * a letter sets the key, a statement's pill flips it, plus points, "Tặng
 * điểm" and delete. Changes collect in a working copy; "Lưu" sends them as
 * one correction and the server regrades every attempt on the version.
 * "Sửa nội dung" opens the one-question editor.
 */
export function QuestionCorrections({
  lessonId,
  questions,
  config,
  submitted,
  locked,
}: {
  lessonId: number;
  /** The current version's questions, removed ones included. */
  questions: Question[];
  config: Pick<LessonConfig, "points">;
  submitted: number;
  /** Corrections are refused (draft or archived): read-only. */
  locked: boolean;
}) {
  const [draft, setDraft] = useState(questions);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean }>();
  const [pending, startTransition] = useTransition();

  // Fresh server data after a save (refresh()) is the new baseline.
  useEffect(() => setDraft(questions), [questions]);
  // Next keeps a left route mounted but hidden: its effects clean up, so a
  // "Đã lưu" line does not greet the teacher on the way back.
  useEffect(() => () => setMessage(undefined), []);

  const corrections = useMemo(
    () => diffCorrections(questions, draft),
    [questions, draft],
  );
  const dirty = corrections.length > 0;
  const texts = useMemo(() => questionTexts(questions), [questions]);
  // Points as a new attempt would get them, for the headers.
  const shown = useMemo(() => {
    const live = liveQuestions(draft);
    const plan = pointsPlan(live, config.points);
    return new Map(live.map((q, i) => [q.id, plan[i] ?? 0]));
  }, [draft, config.points]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (id: string, change: (q: Question) => Question) => {
    setMessage(undefined);
    setDraft((qs) => qs.map((q) => (q.id === id ? change(q) : q)));
  };

  const save = () =>
    startTransition(async () => {
      setConfirm(false);
      const result = await correctQuestions({ id: lessonId, corrections });
      setMessage(
        result.ok
          ? { text: t.saved(result.data.regraded), error: false }
          : { text: result.message, error: true },
      );
    });

  let n = 0;
  return (
    <TexProvider texts={texts}>
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-4">
        <output
          aria-live="polite"
          className={cn(
            "min-w-0 flex-1 text-sm",
            message?.error ? "text-danger-text" : "text-muted-foreground",
          )}
        >
          {message?.text ?? t.changes(corrections.length)}
        </output>
        <Button
          variant="secondary"
          size="sm"
          disabled={!dirty || pending}
          onClick={() => {
            setDraft(questions);
            setMessage(undefined);
          }}
        >
          <RotateCcw aria-hidden />
          {t.cancel}
        </Button>
        <Button
          size="sm"
          disabled={!dirty || pending || locked}
          onClick={() => setConfirm(true)}
        >
          <Save aria-hidden />
          {pending ? t.saving : t.save}
        </Button>
      </div>

      <ol aria-label={t.listLabel} className="flex flex-col gap-4">
        {draft.map((q, i) => {
          if (questions[i]?.removed) return null;
          const index = n++;
          const label = index + 1;
          if (q.removed)
            return (
              <li
                key={q.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-danger/50 bg-danger-soft/40 p-4 text-sm"
              >
                <span className="min-w-0 flex-1">{t.removed(label)}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    update(q.id, ({ removed: _, ...rest }) => rest as Question)
                  }
                >
                  <RotateCcw aria-hidden />
                  {t.undo}
                </Button>
              </li>
            );
          const editable = pointsEditable(config, q.type) && !locked;
          return (
            <li key={q.id} id={`q-${q.id}`} className="scroll-mt-20">
              <PreviewQuestion
                question={q}
                index={index}
                points={shown.get(q.id) ?? 0}
                hasIssue={false}
                onMark={
                  locked
                    ? undefined
                    : (item) =>
                        update(q.id, (x) =>
                          x.type === "mcq"
                            ? { ...x, answer: item }
                            : x.type === "tf"
                              ? {
                                  ...x,
                                  statements: x.statements.map((s, j) =>
                                    j === item
                                      ? { ...s, answer: !s.answer }
                                      : s,
                                  ),
                                }
                              : x,
                        )
                }
                toolbar={
                  <>
                    {editable ? (
                      <PointsInput
                        label={t.points(label)}
                        value={q.points ?? 1}
                        onChange={(points) =>
                          update(q.id, (x) => ({ ...x, points }))
                        }
                      />
                    ) : (
                      <span className="text-xs">{t.pointsShared}</span>
                    )}
                    <button
                      type="button"
                      aria-pressed={Boolean(q.free)}
                      aria-label={t.freeLabel(label, Boolean(q.free))}
                      title={t.freeLabel(label, Boolean(q.free))}
                      disabled={locked}
                      onClick={() =>
                        update(
                          q.id,
                          ({ free, ...rest }) =>
                            (free ? rest : { ...rest, free: true }) as Question,
                        )
                      }
                      className={cn(
                        iconButton,
                        q.free &&
                          "bg-accent-soft text-accent-text hover:bg-accent-soft",
                      )}
                    >
                      <Gift aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={t.remove(label)}
                      title={t.remove(label)}
                      disabled={locked}
                      onClick={() =>
                        update(q.id, (x) => ({ ...x, removed: true }))
                      }
                      className={cn(
                        iconButton,
                        "text-danger-text hover:bg-danger-soft",
                      )}
                    >
                      <Trash2 aria-hidden />
                    </button>
                    {dirty || locked ? (
                      <span
                        aria-disabled
                        title={locked ? undefined : t.saveFirst}
                        className="inline-flex h-10 items-center gap-1.5 px-2 font-semibold text-muted-foreground/60 text-sm"
                      >
                        <PenLine aria-hidden className="size-4" />
                        {t.editContent}
                      </span>
                    ) : (
                      <Link
                        href={`/admin/lessons/${lessonId}/questions/${q.id}`}
                        prefetch={false}
                        aria-label={t.editContentLabel(label)}
                        className="inline-flex h-10 items-center gap-1.5 rounded-full px-2 font-semibold text-primary text-sm hover:bg-primary-soft"
                      >
                        <PenLine aria-hidden className="size-4" />
                        {t.editContent}
                      </Link>
                    )}
                  </>
                }
                footer={
                  <>
                    {q.type === "short" && !locked && (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span aria-hidden className="font-medium">
                          {t.shortAnswer(label)}
                        </span>
                        <Input
                          aria-label={t.shortAnswer(label)}
                          value={q.answer}
                          maxLength={100}
                          onChange={(e) =>
                            update(q.id, (x) =>
                              x.type === "short"
                                ? { ...x, answer: e.target.value }
                                : x,
                            )
                          }
                          className="num h-10 w-40"
                        />
                      </div>
                    )}
                    {q.free && (
                      <p className="flex items-center gap-2 rounded-lg bg-accent-soft px-3.5 py-2.5 font-medium text-accent-text text-sm">
                        <Gift aria-hidden className="size-4" />
                        {t.freeBadge}
                      </p>
                    )}
                  </>
                }
              />
            </li>
          );
        })}
      </ol>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t.confirmTitle}
        closeLabel={t.close}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {t.cancel}
            </Button>
            <Button disabled={pending} onClick={save}>
              {t.confirm}
            </Button>
          </>
        }
      >
        <p>{t.confirmBody(corrections.length, submitted)}</p>
      </Dialog>
    </TexProvider>
  );
}

/**
 * A question's points. The text is the field's own state, so "0," can be
 * typed on the way to "0,25"; only a number from 0 to 100 is kept.
 */
function PointsInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (points: number) => void;
}) {
  const [text, setText] = useState(format(value));
  // A reset (Hủy, a save) brings the value back from outside.
  useEffect(() => {
    setText((t) => (parsePoints(t) === value ? t : format(value)));
  }, [value]);
  return (
    <div className="flex items-center gap-1.5">
      <Input
        aria-label={label}
        inputMode="decimal"
        value={text}
        aria-invalid={parsePoints(text) === null || undefined}
        onChange={(e) => {
          setText(e.target.value);
          const n = parsePoints(e.target.value);
          if (n !== null) onChange(n);
        }}
        onBlur={() => setText(format(value))}
        className="num h-9 w-20 px-2 text-right text-sm"
      />
      <span aria-hidden>đ</span>
    </div>
  );
}

const format = (n: number) => String(n).replace(".", ",");

function parsePoints(text: string): number | null {
  const s = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n <= 100 ? n : null;
}
