import type { MetadataRoute } from "next";
import { PWA } from "@/lib/pwa";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PWA.name,
    short_name: PWA.shortName,
    description: PWA.description,
    start_url: PWA.startUrl,
    scope: PWA.scope,
    display: "standalone",
    orientation: "portrait",
    background_color: PWA.backgroundColor,
    theme_color: PWA.themeColor,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Used by Chrome's richer install UI: at least one per form factor, each
    // side 320–3840px, max:min ratio under 2.3, identical ratio per factor.
    screenshots: [
      {
        src: "/screenshots/dashboard-narrow.png",
        sizes: "412x915",
        type: "image/png",
        form_factor: "narrow",
        label: "Studio dashboard on a phone",
      },
      {
        src: "/screenshots/dashboard-wide.png",
        sizes: "1280x800",
        type: "image/png",
        form_factor: "wide",
        label: "Studio dashboard on a desktop",
      },
    ],
  };
}
