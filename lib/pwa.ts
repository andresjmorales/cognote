/** Prefixes the service worker must never touch: /api, /auth and /portal are
 *  per-session (public/sw.js EXCLUDED). That file is plain JS and cannot
 *  import this module, so lib/pwa.test.ts asserts the two stay in sync. */
export const CACHE_EXCLUDED_PATTERN = /^\/(api|auth|portal)(?:\/|$)/;

export type IosBrowserSignals = {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  /** Whether the browser defines navigator.standalone, which only Safari on iOS
   *  does. Read it as `"standalone" in navigator`. */
  hasStandaloneProperty: boolean;
};

/**
 * True for iPhone/iPad Safari and the other iOS browsers. Used to show install
 * instructions, because iOS fires no beforeinstallprompt (Chromium only).
 *
 * navigator.standalone is the strongest signal, being unique to Safari on iOS.
 * The user-agent checks cover WKWebView browsers that do not expose it, and
 * iPadOS 13+ in desktop mode, which Apple documents as sending a macOS user
 * agent ("iPad will now present itself to websites as a Mac",
 * developer.apple.com/videos/play/wwdc2019/203) — a claim its WebKit notes
 * qualify: narrow Split View/Slide Over and the iPad mini keep an iPad agent,
 * which is why the iPad token is still worth matching. Real Macs report
 * maxTouchPoints 0, which is what separates them from a desktop-mode iPad.
 */
export function isIosBrowser({
  userAgent,
  platform,
  maxTouchPoints,
  hasStandaloneProperty,
}: IosBrowserSignals): boolean {
  return (
    hasStandaloneProperty ||
    /iphone|ipad|ipod/i.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  );
}

/** Shared PWA metadata. Kept in lib/ so vitest's node environment can cover it.
 *  themeColor is the light default; themeColorDark is the dark surface. The
 *  theme-color meta follows the in-app teacher theme (a localStorage preference
 *  that deliberately does not follow the OS). */
export const PWA = {
  name: "CogNote Studio",
  shortName: "CogNote",
  description:
    "Studio management for private music teachers: scheduling, attendance, family portals, and progress tracking.",
  themeColor: "#ffffff", // --color-surface (light)
  themeColorDark: "#1c1f28", // --color-surface (dark)
  backgroundColor: "#faf9f7", // --color-background (light) — matches <body>, avoids a white flash
  startUrl: "/",
  scope: "/",
} as const;

export function themeColorFor(mode: "light" | "dark"): string {
  return mode === "dark" ? PWA.themeColorDark : PWA.themeColor;
}
