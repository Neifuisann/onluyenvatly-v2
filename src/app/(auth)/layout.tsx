import { PublicHeader } from "@/components/public-header";

/** Static shell for login/register: public header + one centered card. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicHeader />
      <main
        id="main"
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 sm:py-12"
      >
        {children}
      </main>
    </>
  );
}
