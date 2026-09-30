import type { Metadata } from "next";
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
      <RegisterForm />
    </AuthScreen>
  );
}
