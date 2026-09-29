import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { RegisterForm } from "@/features/auth/components/register-form";
import { authCopy } from "@/lib/messages";

export const metadata: Metadata = { title: authCopy.registerTitle };

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <h1 className="heading-page">{authCopy.registerTitle}</h1>
        <CardDescription>{authCopy.registerLead}</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
      </CardContent>
    </Card>
  );
}
