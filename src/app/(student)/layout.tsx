import { Suspense } from "react";
import { AppShell, AppShellSkeleton } from "@/components/app-shell/app-shell";
import { requireStudent } from "@/features/auth/guards";
import { getSettings } from "@/features/settings/queries";

/** Every student page is behind `requireStudent()` (06 §2). */
export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <StudentShell>{children}</StudentShell>
    </Suspense>
  );
}

async function StudentShell({ children }: { children: React.ReactNode }) {
  // Sequential on purpose: the settings read stays behind the cookie read, so
  // prerendering never touches the database.
  const user = await requireStudent();
  const settings = await getSettings();
  return (
    <AppShell
      user={user}
      variant="student"
      announcement={settings.announcement}
    >
      {children}
    </AppShell>
  );
}
