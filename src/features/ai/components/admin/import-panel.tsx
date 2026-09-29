"use client";

import { FileUp, RotateCcw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useDeferredValue,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { FormField, fieldA11y } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseLessonText } from "@/features/lessons/domain/parser";
import { countByType } from "@/features/lessons/domain/summary";
import { createImportedLesson, createImportUpload } from "../../admin-actions";
import {
  cleanImportText,
  IMPORT_MAX_BYTES,
  IMPORT_TYPES,
  type ImportContentType,
  importTitle,
} from "../../domain/import";
import { importCopy as t } from "../../messages";

type Phase = "idle" | "uploading" | "reading" | "done" | "failed";

const ACCEPT = ".pdf,.docx,.png,.jpg,.jpeg,.webp";
const BY_EXTENSION: Record<string, ImportContentType> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/** The declared type, or one from the extension (some browsers send none for .docx). */
function contentTypeOf(file: File): ImportContentType | null {
  if (file.type in IMPORT_TYPES) return file.type as ImportContentType;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXTENSION[ext] ?? null;
}

/**
 * `/admin/import` (S7-04, 09 §4): pick a file → signed upload to Storage →
 * `POST /api/ai/import` streams the lesson text, parsed as it arrives → the
 * teacher creates a draft and continues in the editor. A stream that stops
 * midway keeps what arrived (09 §6).
 */
export function ImportPanel({ aiEnabled }: { aiEnabled: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [creating, startCreate] = useTransition();
  const outputId = useId();

  const deferred = useDeferredValue(text);
  const parsed = useMemo(() => {
    const clean = cleanImportText(deferred);
    const { questions, issues } = parseLessonText(clean);
    return {
      clean,
      counts: countByType(questions),
      total: questions.length,
      errors: issues.filter((i) => i.severity === "error").length,
      figures: clean.split("\n").filter((l) => l.trim() === "[Hình]").length,
    };
  }, [deferred]);

  const busy = phase === "uploading" || phase === "reading";

  const pick = (f: File | null) => {
    setFile(f);
    setError(undefined);
    if (f) setTitle((old) => old || importTitle(f.name));
  };

  const start = async () => {
    if (!file) return setError(t.pickFile);
    const contentType = contentTypeOf(file);
    if (!contentType) return setError(t.badType);
    if (file.size > IMPORT_MAX_BYTES) return setError(t.tooBig);
    setError(undefined);
    setText("");
    setPhase("uploading");
    const fail = (message: string) => {
      setError(message);
      setPhase("failed");
    };
    try {
      const ticket = await createImportUpload({
        contentType,
        bytes: file.size,
      });
      if (!ticket.ok) return fail(ticket.message);
      const put = await fetch(ticket.data.uploadUrl, {
        method: "PUT",
        headers: { "content-type": contentType, "x-upsert": "false" },
        body: file,
      }).catch(() => null);
      if (!put?.ok) return fail(t.uploadFailed);

      setPhase("reading");
      const res = await fetch("/api/ai/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: ticket.data.path }),
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        return fail(body?.message ?? t.unavailable);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let received = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          received += decoder.decode(value, { stream: true });
          setText(received);
        }
      } catch {
        return fail(received.trim() ? t.stopped : t.unavailable);
      }
      if (!received.trim()) return fail(t.nothing);
      setPhase("done");
    } catch {
      fail(t.uploadFailed);
    }
  };

  const create = () =>
    startCreate(async () => {
      const result = await createImportedLesson({
        title: title.trim() || importTitle(file?.name ?? ""),
        sourceText: cleanImportText(text),
      });
      if (!result.ok) return setError(result.message);
      router.push(`/admin/lessons/${result.data.id}/edit`);
    });

  const reset = () => {
    setPhase("idle");
    setText("");
    setError(undefined);
    setFile(null);
    setTitle("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const hasText = text.trim().length > 0;

  return (
    <div className="flex flex-col gap-6">
      {!aiEnabled && <Alert variant="danger">{t.aiOff}</Alert>}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void start();
        }}
        className="flex flex-col gap-4 rounded-lg border bg-surface p-4 shadow-card"
      >
        <FormField id="import-file" label={t.file} hint={t.fileHint}>
          <input
            ref={fileRef}
            {...fieldA11y("import-file", undefined, t.fileHint)}
            type="file"
            accept={ACCEPT}
            disabled={busy}
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
            className="min-h-11 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:font-medium file:text-foreground"
          />
        </FormField>
        <FormField
          id="import-title"
          label={t.lessonTitle}
          hint={t.lessonTitleHint}
        >
          <Input
            {...fieldA11y("import-title", undefined, t.lessonTitleHint)}
            value={title}
            maxLength={200}
            disabled={busy}
            onChange={(e) => setTitle(e.target.value)}
          />
        </FormField>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || !aiEnabled}>
            <Sparkles aria-hidden />
            {t.start}
          </Button>
          {(phase === "done" || phase === "failed") && (
            <Button type="button" variant="secondary" onClick={reset}>
              <RotateCcw aria-hidden />
              {t.again}
            </Button>
          )}
        </div>
      </form>

      <div aria-live="polite" className="flex flex-col gap-2">
        {phase === "uploading" && (
          <p className="flex items-center gap-2 text-sm">
            <FileUp aria-hidden className="size-4" />
            {t.uploading}
          </p>
        )}
        {phase === "reading" && (
          <p className="text-sm">
            {t.reading} {parsed.total > 0 && `${t.received(parsed.total)}.`}
          </p>
        )}
        {error && <Alert variant="danger">{error}</Alert>}
      </div>

      {hasText && (
        <div className="flex flex-col gap-3">
          {!busy && (
            <div className="flex flex-col gap-1 rounded-lg border bg-surface p-4 text-sm">
              {phase === "done" && (
                <h2 className="font-semibold text-base">{t.doneTitle}</h2>
              )}
              <p>
                {t.summary({
                  total: parsed.total,
                  mcq: parsed.counts.mcq,
                  tf: parsed.counts.tf,
                  short: parsed.counts.short,
                })}
              </p>
              <p>{t.issues(parsed.errors)}</p>
              {parsed.figures > 0 && <p>{t.figures(parsed.figures)}</p>}
              <Button
                type="button"
                className="mt-2 w-full sm:w-fit"
                onClick={create}
                disabled={creating || parsed.total === 0}
              >
                {creating ? t.creating : t.create}
              </Button>
            </div>
          )}
          <h2 id={`${outputId}-title`} className="font-semibold">
            {t.output}
          </h2>
          <section
            // Scrollable, so it must be reachable by keyboard (axe).
            // biome-ignore lint/a11y/noNoninteractiveTabindex: scroll container
            tabIndex={0}
            aria-labelledby={`${outputId}-title`}
            className="max-h-[28rem] overflow-auto rounded-lg border bg-muted/40 p-3"
          >
            <pre className="whitespace-pre-wrap break-words font-mono text-sm">
              {text}
            </pre>
          </section>
        </div>
      )}
    </div>
  );
}
