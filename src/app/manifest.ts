import type { MetadataRoute } from "next";
import { shellCopy } from "@/lib/messages";

/**
 * PWA install (07 §7, S8-05). No service worker: pages are never cached
 * offline in v2.0, so a test can't be served stale. Colors are the light
 * theme's `--background` and `--primary` in sRGB (icons: scripts/make-icons.ts).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: shellCopy.appName,
    short_name: shellCopy.appShortName,
    description: shellCopy.appDescription,
    lang: "vi",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f9fafc",
    theme_color: "#1e59cd",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
