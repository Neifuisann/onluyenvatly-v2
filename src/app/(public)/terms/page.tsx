import type { Metadata } from "next";
import { PolicyPage } from "@/components/policy-page";
import { termsPolicy } from "@/content/policies";

export const metadata: Metadata = {
  title: termsPolicy.title,
  description: termsPolicy.lead,
  alternates: { canonical: "/terms" },
};

/** `/terms` (05 §1): short rules of use. Static. */
export default function TermsPage() {
  return <PolicyPage policy={termsPolicy} />;
}
