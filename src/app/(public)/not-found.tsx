import type { Metadata } from "next";
import { NotFoundContent } from "@/components/not-found-content";
import { notFoundCopy as t } from "@/lib/messages";

export const metadata: Metadata = {
  title: t.title,
  robots: { index: false },
};

/** A missing theory topic or share link, inside the public header/footer. */
export default function PublicNotFound() {
  return <NotFoundContent />;
}
