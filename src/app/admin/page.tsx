import { LayoutDashboard } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { placeholderCopy, shellCopy } from "@/lib/messages";

export const metadata: Metadata = { title: shellCopy.adminNavItems.overview };

// Empty admin shell for M1; the dashboard lands in S6-06.
export default function AdminHomePage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <h1 className="font-semibold text-2xl">
        {shellCopy.adminNavItems.overview}
      </h1>
      <EmptyState
        icon={LayoutDashboard}
        title={placeholderCopy.adminEmptyTitle}
        description={placeholderCopy.adminEmptyBody}
      />
    </div>
  );
}
