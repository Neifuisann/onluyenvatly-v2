import type { Metadata } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import { themeScript } from "@/lib/theme";
import "./globals.css";

const sans = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["vietnamese", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ôn Luyện Vật Lý",
    template: "%s · Ôn Luyện Vật Lý",
  },
  description: "Luyện đề Vật lý THPT theo cấu trúc đề thi mới.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      data-theme-pref="system"
      // The theme script changes class/data attributes before hydration.
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
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
