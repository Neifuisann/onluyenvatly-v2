/**
 * Which status changes `setStatus` may make (S6-02). Pending students are
 * decided in the queue (`approve`/`reject` move only `pending` rows, in SQL);
 * enable/disable only moves accounts that already were decided.
 */
import type { StudentStatus } from "./list";

/** Disable an active account; re-enable a disabled (or wrongly rejected) one. */
export function canSetStatus(
  from: StudentStatus,
  to: "active" | "disabled",
): boolean {
  return to === "disabled"
    ? from === "active"
    : from === "disabled" || from === "rejected";
}
