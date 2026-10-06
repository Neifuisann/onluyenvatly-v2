/**
 * Full-screen admin tools (the lesson editor, 07 §5.6): no sidebar or nav,
 * the page owns the whole viewport and scrolls inside its panes (`clip`,
 * so focus or scrollIntoView can never shift the frame). Each page
 * calls `requireAdmin()` itself (06 §2).
 */
export default function WorkspaceLayout({ children }: LayoutProps<"/admin">) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="flex h-dvh flex-col overflow-clip bg-background outline-none"
    >
      {children}
    </main>
  );
}
