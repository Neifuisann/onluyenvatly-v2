"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AssignableLesson } from "@/features/lessons/admin-queries";
import { subjectLabel } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { setLessons } from "../../actions";
import { classesCopy as t } from "../../messages";

type Message = { text: string; error: boolean };

/** Accent-free lowercase, so "dao dong" finds "Dao động". */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

/**
 * "Giao bài" (B-03): a checkbox per published lesson of the teacher, with a
 * search box. Saving sends the whole set; the server gives and takes back
 * the difference.
 */
export function LessonPicker({
  classId,
  lessons,
  assigned,
  archived,
}: {
  classId: number;
  lessons: readonly AssignableLesson[];
  assigned: readonly number[];
  archived: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(() => new Set(assigned));
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<Message>();

  const visible = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    return words.length
      ? lessons.filter((l) => words.every((w) => fold(l.title).includes(w)))
      : lessons;
  }, [lessons, query]);

  if (lessons.length === 0)
    return (
      <div className="grid justify-items-start gap-3">
        <p className="text-muted-foreground text-sm">{t.lessonsEmpty}</p>
        <Link
          href="/admin/lessons"
          prefetch={false}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          {t.lessonsSection}
        </Link>
      </div>
    );

  const toggle = (id: number, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const save = () => {
    setMessage(undefined);
    // Keep assigned lessons that are no longer listed (unpublished since).
    const listed = new Set(lessons.map((l) => l.id));
    const lessonIds = [
      ...assigned.filter((id) => !listed.has(id)),
      ...lessons.filter((l) => selected.has(l.id)).map((l) => l.id),
    ];
    startTransition(async () => {
      const result = await setLessons({ id: classId, lessonIds });
      setMessage(
        result.ok
          ? {
              text: t.lessonsSaved(result.data.added, result.data.removed),
              error: false,
            }
          : { text: result.message, error: true },
      );
    });
  };

  const count = lessons.filter((l) => selected.has(l.id)).length;

  return (
    <div className="grid gap-4">
      <div className="relative">
        <Label htmlFor="class-lesson-q" className="sr-only">
          {t.filterLessons}
        </Label>
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id="class-lesson-q"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.filterLessons}
          autoComplete="off"
          className="pl-11"
        />
      </div>
      <fieldset disabled={archived || pending} className="min-w-0">
        <legend className="sr-only">{t.lessonsLabel}</legend>
        <ul className="max-h-[28rem] divide-y overflow-y-auto rounded-lg border border-border/70 dark:border-border">
          {visible.map((l) => (
            <li key={l.id}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-primary"
                  checked={selected.has(l.id)}
                  onChange={(e) => toggle(l.id, e.target.checked)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-medium">
                    {l.title}
                  </span>
                  <span className="block text-muted-foreground text-xs">
                    {[
                      subjectLabel(l.subject),
                      l.grade ? t.gradeOption(l.grade) : null,
                      t.lessonQuestions(l.questionCount),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={archived || pending}>
          {pending ? t.saving : t.lessonsSave}
        </Button>
        <span className="text-muted-foreground text-sm">
          {t.selectedLessons(count)}
        </span>
        <output
          aria-live="polite"
          className={cn(
            "min-h-5 text-sm",
            message?.error ? "text-danger-text" : "text-muted-foreground",
          )}
        >
          {message?.text}
        </output>
      </div>
    </div>
  );
}
