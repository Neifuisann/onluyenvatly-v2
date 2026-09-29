import { Suspense } from "react";
import { AppShell, AppShellSkeleton } from "@/components/app-shell/app-shell";
import { requireAdmin } from "@/features/auth/guards";
import { getPendingCount } from "@/features/students/admin-queries";

/** Every admin page is behind `requireAdmin()` (06 §2). */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  // Shared cache (tag `pendingStudents`), so it is not a query per page view.
  const pending = await getPendingCount();
  return (
    <AppShell
      user={user}
      variant="admin"
      badges={{ "/admin/students": pending }}
    >
      {children}
    </AppShell>
  );
}
