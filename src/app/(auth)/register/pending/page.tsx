import { Hourglass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { authCopy } from "@/lib/messages";

export const metadata: Metadata = {
  title: authCopy.pendingTitle,
  robots: { index: false },
};

/** "Chờ duyệt" screen after registering (05 §1). */
export default function RegisterPendingPage() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Hourglass aria-hidden className="size-7" strokeWidth={1.75} />
        </span>
        <h1 className="heading-page">{authCopy.pendingTitle}</h1>
        <p className="text-muted-foreground">{authCopy.pendingBody}</p>
        <Link href="/login" className={buttonVariants({ size: "lg" })}>
          {authCopy.pendingBack}
        </Link>
      </CardContent>
    </Card>
  );
}
