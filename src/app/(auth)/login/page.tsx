import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthScreen } from "@/features/auth/components/auth-screen";
import { LoginForm } from "@/features/auth/components/login-form";
import { authCopy } from "@/lib/messages";

export const metadata: Metadata = { title: authCopy.loginTitle };

export default function LoginPage() {
  return (
    <AuthScreen
      pose="wave"
      title={authCopy.loginTitle}
      lead={authCopy.loginLead}
      compactLead={authCopy.loginLeadCompact}
    >
      {/* useSearchParams (for ?next=) needs a boundary to keep the shell static. */}
      <Suspense fallback={<FormSkeleton />}>
        <LoginForm />
      </Suspense>
    </AuthScreen>
  );
}

function FormSkeleton() {
  return (
    <div className="grid gap-5">
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
      <Skeleton className="h-12 rounded-full" />
    </div>
  );
}
