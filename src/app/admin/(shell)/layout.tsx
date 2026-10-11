import { Suspense } from "react";
import { AppShell, AppShellSkeleton } from "@/components/app-shell/app-shell";
import { requireTeacher } from "@/features/auth/guards";

/**
 * Every page of the teacher workspace is behind `requireTeacher()` (06 §2,
 * B-03); platform pages also call `requireAdmin()` themselves.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: React.ReactNode }) {
  const user = await requireTeacher();
  return (
    <AppShell user={user} variant="admin">
      {children}
    </AppShell>
  );
}
