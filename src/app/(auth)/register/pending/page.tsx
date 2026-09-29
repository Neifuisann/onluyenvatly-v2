import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AuthScreen } from "@/features/auth/components/auth-screen";
import { authCopy } from "@/lib/messages";

export const metadata: Metadata = {
  title: authCopy.pendingTitle,
  robots: { index: false },
};

/** "Chờ duyệt" screen after registering (05 §1). */
export default function RegisterPendingPage() {
  return (
    <AuthScreen
      pose="waiting"
      steps={2}
      title={authCopy.pendingTitle}
      lead={authCopy.pendingBody}
    >
      <Link
        href="/login"
        className={buttonVariants({ size: "lg", className: "w-full" })}
      >
        {authCopy.pendingBack}
      </Link>
    </AuthScreen>
  );
}
