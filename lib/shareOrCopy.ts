export type ShareOrCopyResult =
  | { method: "share" }
  | { method: "copy" }
  | { method: "none"; error?: string };

/**
 * Tries the native share sheet (e.g. iOS Share) first when available,
 * then falls back to copying to clipboard. Works around iOS Safari
 * clipboard restrictions by using the share sheet (Copy is an option there).
 */
export async function shareOrCopyUrl(
  url: string,
  options?: { title?: string; text?: string }
): Promise<ShareOrCopyResult> {
  const fullUrl =
    url.startsWith("http") ? url : `${typeof window !== "undefined" ? window.location.origin : ""}${url}`;
  const title = options?.title ?? "Practice link";
  const text = options?.text ?? "Practice link";

  // Prefer Web Share API when available (shows native share sheet on iOS with Copy, Messages, Mail, etc.)
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        url: fullUrl,
        title,
        text,
      });
      return { method: "share" };
    } catch (err) {
      // User cancelled (ABORT_ERR) or share failed – fall back to clipboard
      if (err instanceof Error && err.name === "AbortError") {
        // User dismissed share sheet without sharing; still try to copy so they have the link
      }
    }
  }

  // Fallback: copy to clipboard
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(fullUrl);
      return { method: "copy" };
    }
  } catch {
    // Clipboard can fail on iOS in some contexts
  }

  return { method: "none", error: "Share and copy not available" };
}
