import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { safeNextPath } from "@/features/auth/core/next-path";
import { requireSessionUser } from "@/features/auth/guards";
import { authCopy } from "@/lib/messages";

export const metadata: Metadata = {
  title: authCopy.changePasswordTitle,
  robots: { index: false },
};

/**
 * Own password change (06 §1). Where a user lands while an admin's reset is
 * pending (the notice says so); S8-04 links it from the settings page.
 * Static shell; the session check and `?next=` sit behind a Suspense boundary.
 */
export default function ChangePasswordPage({
  searchParams,
}: PageProps<"/change-password">) {
  return (
    <Card>
      <CardHeader>
        <h1 className="font-semibold text-2xl leading-tight">
          {authCopy.changePasswordTitle}
        </h1>
        <CardDescription>{authCopy.changePasswordLead}</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<FormSkeleton />}>
          <ChangePasswordGate searchParams={searchParams} />
        </Suspense>
      </CardContent>
    </Card>
  );
}

async function ChangePasswordGate({
  searchParams,
}: {
  searchParams: PageProps<"/change-password">["searchParams"];
}) {
  const user = await requireSessionUser();
  const raw = (await searchParams).next;
  const next = safeNextPath(Array.isArray(raw) ? raw[0] : raw) ?? "";
  return (
    <div className="grid gap-4">
      {user.mustChangePassword && (
        <Alert>{authCopy.changePasswordForced}</Alert>
      )}
      <ChangePasswordForm next={next} />
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
      <Skeleton className="h-12" />
    </div>
  );
}
