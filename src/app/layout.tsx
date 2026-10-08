import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { shellCopy } from "@/lib/messages";
import { siteUrl } from "@/lib/site";
import { themeScript } from "@/lib/theme";
import "./globals.css";

/**
 * Reading face: UI and question text (07 §3.2). Self-hosted subsets, one file
 * per family with Latin + Vietnamese (scripts/subset-fonts.py): Google's
 * split made every Vietnamese page fetch latin, latin-ext and vietnamese.
 */
const sans = localFont({
  src: "./fonts/inter-vi.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

/** Display face: page titles, scores and other big numbers. */
const display = localFont({
  src: "./fonts/bricolage-grotesque-vi.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
  preload: false,
});

/** Code only (the admin lesson editor), so it is not preloaded on every page. */
const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["vietnamese", "latin"],
  display: "swap",
  preload: false,
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

/** Browser chrome uses the redesign palette. */
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
      <body className="flex min-h-full flex-col">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
