import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "@/features/auth/components/login-form";
import { authCopy } from "@/lib/messages";

export const metadata: Metadata = { title: authCopy.loginTitle };

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <h1 className="font-semibold text-2xl leading-tight">
          {authCopy.loginTitle}
        </h1>
        <CardDescription>{authCopy.loginLead}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* useSearchParams (for ?next=) needs a boundary to keep the shell static. */}
        <Suspense fallback={<FormSkeleton />}>
          <LoginForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}

function FormSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-12" />
    </div>
  );
}
