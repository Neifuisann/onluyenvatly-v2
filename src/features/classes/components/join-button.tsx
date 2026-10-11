"use client";

import { LogIn } from "lucide-react";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { joinClass } from "../join-actions";
import { classesCopy as t } from "../messages";

/**
 * "Vào lớp" on `/join/<code>`: joining is a POST (a server action), never a
 * side effect of opening the link. On success the action redirects.
 */
export function JoinButton({
  code,
  lessonId,
}: {
  code: string;
  lessonId?: number | undefined;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-3">
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      <Button
        type="button"
        size="lg"
        disabled={pending}
        aria-disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await joinClass(
              lessonId ? { code, lessonId } : { code },
            );
            if (result && !result.ok) setError(result.message);
          })
        }
      >
        <LogIn aria-hidden />
        {pending ? t.join.joining : t.join.join}
      </Button>
    </div>
  );
}
