"use client";

import {
  Ban,
  Check,
  Copy,
  KeyRound,
  LogOut,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormField, fieldA11y } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  approve,
  deleteStudent,
  reject,
  resetPassword,
  revokeSessions,
  setStatus,
} from "../admin-actions";
import type { StudentStatus } from "../domain/list";
import { studentsCopy as t } from "../messages";
import { useRun } from "./use-run";

type Confirm = "reset" | "revoke" | "disable" | "reject" | "delete";

/**
 * The action panel of `/admin/students/[id]` (S6-02). Every destructive
 * action asks first; deleting needs the student's name typed. A temporary
 * password lives only in this component's state, in a dialog, and is dropped
 * when the dialog closes.
 */
export function StudentActions({
  id,
  fullName,
  status,
  attemptTotal,
}: {
  id: string;
  fullName: string;
  status: StudentStatus;
  attemptTotal: number;
}) {
  const router = useRouter();
  const { pending, message, setMessage, run } = useRun();
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [typedName, setTypedName] = useState("");
  const [nameError, setNameError] = useState<string>();
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copyNote, setCopyNote] = useState("");
  const [deleting, setDeleting] = useState(false);

  const close = () => {
    setConfirm(null);
    setTypedName("");
    setNameError(undefined);
  };

  const submit = async (kind: Confirm) => {
    if (kind === "delete") {
      // Stay open on a name mismatch: the field says what is wrong.
      setDeleting(true);
      const result = await deleteStudent({ id, confirmName: typedName });
      if (!result.ok) {
        setDeleting(false);
        const mismatch = result.fieldErrors?.confirmName;
        if (mismatch) {
          setNameError(mismatch);
          return;
        }
        close();
        setMessage({ text: result.message, error: true });
        return;
      }
      close();
      setMessage({ text: t.deleted, error: false });
      router.replace("/admin/students?view=all");
      return;
    }
    close();
    if (kind === "reset")
      run(
        () => resetPassword(id),
        () => "",
        ({ password }) => {
          setCopyNote("");
          setTempPassword(password);
        },
      );
    else if (kind === "revoke")
      run(
        () => revokeSessions(id),
        (d) => t.revoked(d.revoked),
      );
    else if (kind === "disable")
      run(
        () => setStatus({ id, status: "disabled" }),
        () => t.disabled,
      );
    else
      run(
        () => reject({ ids: [id] }),
        (d) => t.rejected(d.done, d.skipped),
      );
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword ?? "");
      setCopyNote(t.copied);
    } catch {
      setCopyNote(t.copyFailed);
    }
  };

  const texts: Record<
    Exclude<Confirm, "delete">,
    { title: string; body: string; confirm: string; danger?: boolean }
  > = {
    reset: { title: t.resetTitle, body: t.resetBody, confirm: t.resetConfirm },
    revoke: {
      title: t.revokeTitle,
      body: t.revokeBody,
      confirm: t.revokeConfirm,
    },
    disable: {
      title: t.disableTitle,
      body: t.disableBody,
      confirm: t.disableConfirm,
      danger: true,
    },
    reject: {
      title: t.rejectTitle,
      body: t.rejectBody(1),
      confirm: t.rejectConfirm,
      danger: true,
    },
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {status === "pending" && (
          <>
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () => approve({ ids: [id] }),
                  (d) => t.approved(d.done, d.skipped),
                )
              }
            >
              <UserCheck aria-hidden />
              {t.approve}
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => setConfirm("reject")}
            >
              <UserX aria-hidden />
              {t.reject}
            </Button>
          </>
        )}
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => setConfirm("reset")}
        >
          <KeyRound aria-hidden />
          {t.resetPassword}
        </Button>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => setConfirm("revoke")}
        >
          <LogOut aria-hidden />
          {t.revokeSessions}
        </Button>
        {status === "active" && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => setConfirm("disable")}
          >
            <Ban aria-hidden />
            {t.disable}
          </Button>
        )}
        {(status === "disabled" || status === "rejected") && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              run(
                () => setStatus({ id, status: "active" }),
                () => t.enabled,
              )
            }
          >
            <UserCheck aria-hidden />
            {t.enable}
          </Button>
        )}
        <Button
          variant="secondary"
          className="text-danger-text"
          disabled={pending}
          onClick={() => setConfirm("delete")}
        >
          <Trash2 aria-hidden />
          {t.delete}
        </Button>
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

      {confirm && confirm !== "delete" && (
        <Dialog
          open
          onClose={close}
          title={texts[confirm].title}
          closeLabel={t.close}
          footer={
            <>
              <Button variant="secondary" onClick={close}>
                {t.cancel}
              </Button>
              <Button
                variant={texts[confirm].danger ? "danger" : "default"}
                disabled={pending}
                onClick={() => submit(confirm)}
              >
                {texts[confirm].confirm}
              </Button>
            </>
          }
        >
          <p>{texts[confirm].body}</p>
        </Dialog>
      )}

      <Dialog
        open={confirm === "delete"}
        onClose={close}
        title={t.deleteTitle}
        closeLabel={t.close}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              {t.cancel}
            </Button>
            <Button
              variant="danger"
              disabled={pending || deleting || typedName.trim() === ""}
              onClick={() => submit("delete")}
            >
              {t.deleteConfirm}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <p>{t.deleteBody(attemptTotal)}</p>
          <FormField
            id="confirm-name"
            label={t.deleteConfirmLabel(fullName)}
            error={nameError}
          >
            <Input
              {...fieldA11y("confirm-name", nameError)}
              value={typedName}
              onChange={(e) => {
                setTypedName(e.target.value);
                setNameError(undefined);
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </FormField>
        </div>
      </Dialog>

      <Dialog
        open={tempPassword !== null}
        onClose={() => setTempPassword(null)}
        title={t.resetDoneTitle}
        closeLabel={t.close}
        footer={
          <Button onClick={() => setTempPassword(null)}>{t.close}</Button>
        }
      >
        <div className="grid gap-3">
          <p>{t.resetDoneBody}</p>
          <div className="flex items-center gap-2">
            <output
              aria-label={t.tempPasswordLabel}
              className="block min-w-0 flex-1 select-all break-all rounded-md border bg-muted px-3 py-2 text-center font-mono text-lg tracking-wider"
            >
              {tempPassword}
            </output>
            <Button variant="secondary" onClick={copy}>
              {copyNote === t.copied ? (
                <Check aria-hidden />
              ) : (
                <Copy aria-hidden />
              )}
              {t.copy}
            </Button>
          </div>
          <p
            aria-live="polite"
            className="min-h-5 text-muted-foreground text-sm"
          >
            {copyNote}
          </p>
        </div>
      </Dialog>
    </div>
  );
}
