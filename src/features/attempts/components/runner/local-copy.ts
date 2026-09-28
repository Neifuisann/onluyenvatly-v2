import type { LocalCopy } from "../../domain/runner-state";

/**
 * The runner's localStorage copy (07 §7: offline tolerance comes from here,
 * not from a service worker). Storage can be full, disabled or private, so
 * every access is best effort.
 */
const key = (attemptId: string) => `attempt:${attemptId}`;

export function readLocal(attemptId: string): LocalCopy | null {
  try {
    const raw = localStorage.getItem(key(attemptId));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    return { answers: v.answers, flagged: v.flagged, dirty: v.dirty === true };
  } catch {
    return null;
  }
}

export function writeLocal(attemptId: string, copy: LocalCopy): void {
  try {
    localStorage.setItem(key(attemptId), JSON.stringify(copy));
  } catch {}
}

export function clearLocal(attemptId: string): void {
  try {
    localStorage.removeItem(key(attemptId));
  } catch {}
}
