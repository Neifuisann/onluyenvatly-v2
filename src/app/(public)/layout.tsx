import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";

/** Public pages (05 §1): theory, gallery, share previews and policies. */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <PublicFooter />
    </>
  );
}
