"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { shareOrCopyUrl } from "@/lib/shareOrCopy";

// navigator.share never changes at runtime; the store shape just gives us a
// hydration-safe read (server snapshot false, client snapshot the real value).
const emptySubscribe = () => () => {};

export function CopyLinkClient({
  url,
  title,
  label,
}: {
  url: string;
  title?: string;
  /** What the link is, e.g. "Portal Link" — renders "Copy Portal Link". */
  label?: string;
}) {
  const [feedback, setFeedback] = useState<"idle" | "shared" | "copied" | "none">("idle");
  const canShare = useSyncExternalStore(
    emptySubscribe,
    () => !!navigator.share,
    () => false
  );

  async function handleClick() {
    const result = await shareOrCopyUrl(url, {
      title: title ?? "Practice link",
      text: title ?? "Practice link",
    });
    if (result.method === "share") {
      setFeedback("shared");
    } else if (result.method === "copy") {
      setFeedback("copied");
    } else {
      setFeedback("none");
    }
    setTimeout(() => setFeedback("idle"), 2500);
  }

  const linkNoun = label ?? "Link";
  const buttonLabel =
    feedback === "shared"
      ? "Shared"
      : feedback === "copied"
        ? "Copied!"
        : feedback === "none"
          ? `Copy ${linkNoun}`
          : canShare
            ? `Share ${linkNoun}`
            : `Copy ${linkNoun}`;

  return (
    <Button size="sm" variant="primary" onClick={handleClick}>
      {buttonLabel}
    </Button>
  );
}
