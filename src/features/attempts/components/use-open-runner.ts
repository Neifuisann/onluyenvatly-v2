"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

/**
 * Submits a start form (`/api/attempts/start`, `/api/review/start`) with
 * `fetch`, then opens the runner with a client navigation, so the runner
 * streams after its cached shell. Without JavaScript the form posts and the
 * route answers 303 (lib/form-route.ts).
 */
export function useOpenRunner(failed: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: { url?: string };
        message?: string;
      } | null;
      const url = json?.ok ? json.data?.url : undefined;
      if (url) {
        // Stays pending until the runner replaces this page.
        router.push(url);
        return;
      }
      if (res.status === 401) router.refresh();
      setError(json?.message ?? failed);
    } catch {
      setError(failed);
    }
    setPending(false);
  }

  return { onSubmit, pending, error };
}
