import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthScreen } from "@/features/auth/components/auth-screen";
import { RegisterForm } from "@/features/auth/components/register-form";
import { authCopy } from "@/lib/messages";

export const metadata: Metadata = { title: authCopy.registerTitle };

export default function RegisterPage() {
  return (
    <AuthScreen
      pose="rocket"
      compact
      steps={1}
      title={authCopy.registerTitle}
      lead={authCopy.registerLead}
    >
      {/* useSearchParams (for ?next=) needs a boundary to keep the shell static. */}
      <Suspense fallback={<Skeleton className="h-[34rem]" />}>
        <RegisterForm />
      </Suspense>
    </AuthScreen>
  );
}
