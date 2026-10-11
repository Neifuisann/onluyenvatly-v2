"use client";

import { UserMinus } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { FormField, fieldA11y } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { addMembers, removeMember } from "../../actions";
import type { MemberChange } from "../../domain/classes";
import { classesCopy as t } from "../../messages";
import type { ClassMemberRow } from "../../queries";
import { ConfirmButton } from "./confirm-button";

type Message = { lines: string[]; error: boolean };

/** What an "add" did, one sentence per outcome. */
function describe(change: MemberChange): string[] {
  return [
    t.added(change.added),
    change.already ? t.already(change.already) : "",
    change.notFound.length ? t.notFound(change.notFound.join(", ")) : "",
    change.invalid.length ? t.invalid(change.invalid.join(", ")) : "",
  ].filter(Boolean);
}

/**
 * The class's students (B-03): a box to add them by phone number and the
 * list with "Xóa khỏi lớp". Phones are shown because the teacher typed
 * them; they never reach a student page.
 */
export function MemberPanel({
  classId,
  members,
  archived,
}: {
  classId: number;
  members: readonly ClassMemberRow[];
  archived: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<Message>();
  const [fieldError, setFieldError] = useState<string>();
  const box = useRef<HTMLTextAreaElement>(null);

  const add = () => {
    const phones = box.current?.value ?? "";
    setMessage(undefined);
    setFieldError(undefined);
    startTransition(async () => {
      const result = await addMembers({ id: classId, phones });
      if (!result.ok) {
        const phonesError = result.fieldErrors?.phones;
        if (phonesError) {
          setFieldError(phonesError);
          box.current?.focus();
        } else setMessage({ lines: [result.message], error: true });
        return;
      }
      const { notFound, invalid } = result.data;
      // Keep only what still needs attention in the box.
      if (box.current) box.current.value = [...notFound, ...invalid].join("\n");
      setMessage({
        lines: describe(result.data),
        error: notFound.length + invalid.length > 0,
      });
    });
  };

  const remove = (userId: string) =>
    startTransition(async () => {
      const result = await removeMember({ id: classId, userId });
      setMessage({
        lines: [result.ok ? t.removed : result.message],
        error: !result.ok,
      });
    });

  return (
    <div className="grid gap-5">
      {!archived && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="grid gap-3"
        >
          <FormField
            id="class-phones"
            label={t.addMembersLabel}
            hint={t.addMembersHint}
            error={fieldError}
          >
            <textarea
              ref={box}
              {...fieldA11y("class-phones", fieldError, t.addMembersHint)}
              name="phones"
              rows={3}
              inputMode="tel"
              autoComplete="off"
              spellCheck={false}
              maxLength={20_000}
              className="min-h-24 w-full min-w-0 rounded-md border border-input bg-surface px-4 py-3 text-base text-foreground transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_var(--primary-soft)] focus-visible:outline-none aria-invalid:border-danger-text"
            />
          </FormField>
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? t.adding : t.addMembers}
            </Button>
          </div>
        </form>
      )}
      <output
        aria-live="polite"
        className={cn(
          "grid gap-1 text-sm empty:hidden",
          message?.error ? "text-danger-text" : "text-muted-foreground",
        )}
      >
        {message?.lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </output>

      {members.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t.membersEmpty}</p>
      ) : (
        <ul
          aria-label={t.membersLabel}
          className="divide-y rounded-lg border border-border/70 dark:border-border"
        >
          {members.map((m) => (
            <li
              key={m.userId}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/students/${m.userId}`}
                  prefetch={false}
                  aria-label={t.viewStudent(m.fullName)}
                  className="break-words font-medium hover:text-primary hover:underline"
                >
                  {m.fullName}
                </Link>
                <p className="num text-muted-foreground text-xs">
                  {[m.phone, m.className, t.addedAt(formatDateTime(m.addedAt))]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <ConfirmButton
                label={<UserMinus aria-hidden />}
                ariaLabel={t.removeName(m.fullName)}
                title={t.remove}
                body={t.removeConfirm(m.fullName)}
                confirmLabel={t.remove}
                variant="ghost"
                size="icon"
                disabled={pending}
                onConfirm={() => remove(m.userId)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
