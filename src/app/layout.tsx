import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import { themeScript } from "@/lib/theme";
import "./globals.css";

/** Reading face: UI and question text (07 §3.2). */
const sans = Inter({
  variable: "--font-inter",
  subsets: ["vietnamese", "latin"],
  display: "swap",
});

/** Display face: page titles, scores and other big numbers. */
const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["vietnamese", "latin"],
  display: "swap",
});

/** Code only (the admin lesson editor), so it is not preloaded on every page. */
const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["vietnamese", "latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "Ôn Luyện Vật Lý",
    template: "%s · Ôn Luyện Vật Lý",
  },
  description:
    "Luyện đề Vật lý THPT theo cấu trúc đề thi mới, chấm điểm ngay và ôn lại đúng chỗ còn sai.",
  applicationName: "Ôn Luyện Vật Lý",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1523" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      data-theme-pref="system"
      // The theme script changes class/data attributes before hydration.
      suppressHydrationWarning
      className={`${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        {/* Static constant (no user input): sets the theme before first paint. */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: constant boot script, see lib/theme.ts
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
