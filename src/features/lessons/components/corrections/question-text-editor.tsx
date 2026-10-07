"use client";

import { Save, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { saveQuestionText } from "../../admin-actions";
import { parseSingleQuestion, sameShape } from "../../domain/corrections";
import { parseLessonText } from "../../domain/parser";
import { correctionCopy, questionsCopy as t } from "../../messages";
import type { Question } from "../../schema";
import type { CodeEditorHandle } from "../editor/code-editor";
import { questionTexts, TexProvider } from "../editor/preview-math";
import { PreviewQuestion } from "../editor/preview-question";

const CodeEditor = dynamic(() => import("../editor/code-editor"), {
  ssr: false,
  loading: () => (
    <div aria-busy="true" className="flex flex-col gap-2 p-3">
      {["a", "b", "c", "d"].map((k) => (
        <Skeleton key={k} className="h-5 w-full" />
      ))}
    </div>
  ),
});

/**
 * "Sửa nội dung" of one published question (B-10): the text editor on that
 * question only, its live preview beside it. "Lưu" replaces the question in
 * place (the server checks it again), regrades, and goes back to the
 * questions page at that question.
 */
export function QuestionTextEditor({
  lessonId,
  question,
  index,
  initialText,
}: {
  lessonId: number;
  question: Question;
  index: number;
  initialText: string;
}) {
  const router = useRouter();
  const back = `/admin/lessons/${lessonId}/questions#q-${question.id}`;
  const handle = useRef<CodeEditorHandle | null>(null);
  const [text, setText] = useState(initialText);
  const deferred = useDeferredValue(text);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(() => {
    const issues = parseLessonText(deferred).issues.filter(
      (i) => i.severity === "error",
    );
    const single = parseSingleQuestion(deferred, question.id);
    return { issues, single };
  }, [deferred, question.id]);
  const preview = parsed.single.ok ? parsed.single.question : null;
  const shapeOk = !preview || sameShape(question, preview);
  const texts = useMemo(
    () => questionTexts(preview ? [preview] : []),
    [preview],
  );
  const dirty = text !== initialText;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await saveQuestionText({
        id: lessonId,
        questionId: question.id,
        sourceText: text,
      });
      if (result.ok) router.push(back);
      else setError(result.message);
    });

  const problem = !parsed.single.ok
    ? parsed.single.message
    : !shapeOk
      ? correctionCopy.shapeChanged
      : null;

  return (
    <TexProvider texts={texts}>
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <output
          aria-live="polite"
          className={cn(
            "min-w-0 flex-1 text-sm",
            error || problem ? "text-danger-text" : "text-muted-foreground",
          )}
        >
          {error ?? problem ?? t.editLead}
        </output>
        <Link
          href={back}
          prefetch={false}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          <X aria-hidden />
          {t.cancel}
        </Link>
        <Button
          size="sm"
          disabled={pending || !dirty || problem !== null}
          onClick={save}
        >
          <Save aria-hidden />
          {pending ? t.saving : t.save}
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section
          aria-label={t.editText}
          className={cn(cardClass, "flex min-h-80 flex-col overflow-hidden")}
        >
          <h2 className="border-b border-border/70 bg-muted/40 px-4 py-2 font-semibold text-sm dark:border-border">
            {t.editText}
          </h2>
          <div className="min-h-0 flex-1 [&_.cm-editor]:h-full">
            <CodeEditor
              initialValue={initialText}
              onChange={setText}
              label={t.editText}
              handleRef={handle}
            />
          </div>
          {parsed.issues.length > 0 && (
            <ul className="space-y-1 border-t border-border/70 bg-danger-soft/40 px-4 py-2 text-danger-text text-sm dark:border-border">
              {parsed.issues.map((i) => (
                <li key={`${i.line}:${i.col}:${i.code}`}>
                  {correctionCopy.lineError(i.line, i.message)}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-label={t.editPreview} className="flex flex-col gap-2">
          <h2 className="sr-only">{t.editPreview}</h2>
          {preview ? (
            <PreviewQuestion
              question={preview}
              index={index}
              points={preview.points ?? question.points ?? 1}
              hasIssue={!shapeOk}
            />
          ) : (
            <Alert variant="danger">{problem}</Alert>
          )}
        </section>
      </div>
    </TexProvider>
  );
}
