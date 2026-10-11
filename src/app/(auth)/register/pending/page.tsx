import { redirect } from "next/navigation";

/**
 * Registration no longer waits for approval (B-03); old links and bookmarks
 * of the "chờ duyệt" screen land on the student's classes.
 */
export default function RegisterPendingPage() {
  redirect("/classes");
}
