/** Shared PWA metadata. Kept in lib/ so vitest's node environment can cover it.
 *  Manifest colours are single-valued: light theme only (dark-mode launch is
 *  governed by the OS, not by the manifest). */
export const PWA = {
  name: "CogNote Studio",
  shortName: "CogNote",
  description:
    "Studio management for private music teachers: scheduling, attendance, family portals, and progress tracking.",
  themeColor: "#ffffff", // --color-surface (light)
  backgroundColor: "#faf9f7", // --color-background (light) — matches <body>, avoids a white flash
  startUrl: "/",
  scope: "/",
} as const;
