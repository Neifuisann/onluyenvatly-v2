import type { Metadata } from "next";
import { PolicyPage } from "@/components/policy-page";
import { privacyPolicy } from "@/content/policies";

export const metadata: Metadata = {
  title: privacyPolicy.title,
  description: privacyPolicy.lead,
  alternates: { canonical: "/privacy" },
};

/** `/privacy` (05 §1): what we keep and why (06 §5). Static. */
export default function PrivacyPage() {
  return <PolicyPage policy={privacyPolicy} />;
}
