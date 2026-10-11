import { redirect } from "next/navigation";
import { requireStudent } from "@/features/auth/guards";
import { getStudentClasses } from "@/features/classes/queries";

/**
 * `/lessons` (B-03): lessons now live in classes. With exactly one class the
 * student lands in it (filters kept); otherwise on the class picker.
 */
export default async function LessonsPage({
  searchParams,
}: PageProps<"/lessons">) {
  const user = await requireStudent();
  const classes = await getStudentClasses(user.id);
  const only = classes.length === 1 ? classes[0] : undefined;
  if (!only) redirect("/classes");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    if (typeof value === "string") params.set(key, value);
  const qs = params.toString();
  redirect(qs ? `/classes/${only.id}?${qs}` : `/classes/${only.id}`);
}
