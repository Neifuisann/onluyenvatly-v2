import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import { shellCopy } from "@/lib/messages";
import { siteUrl } from "@/lib/site";
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
  // Absolute URLs for canonical links and OG images (S8-05).
  metadataBase: siteUrl(),
  title: {
    default: shellCopy.appName,
    template: `%s · ${shellCopy.appName}`,
  },
  description: shellCopy.appDescription,
  applicationName: shellCopy.appName,
  appleWebApp: { title: shellCopy.appShortName, capable: true },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: shellCopy.appName,
  },
};

/** Browser chrome follows the page (light/dark `--background` in sRGB). */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1014" },
  ],
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
