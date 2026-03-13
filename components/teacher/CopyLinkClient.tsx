"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { shareOrCopyUrl } from "@/lib/shareOrCopy";

export function CopyLinkClient({ url, title }: { url: string; title?: string }) {
  const [feedback, setFeedback] = useState<"idle" | "shared" | "copied" | "none">("idle");
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  async function handleClick() {
    const result = await shareOrCopyUrl(url, {
      title: title ?? "Practice link",
      text: "Practice link",
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

  const buttonLabel =
    feedback === "shared"
      ? "Shared"
      : feedback === "copied"
        ? "Copied!"
        : feedback === "none"
          ? "Copy link"
          : canShare
            ? "Share"
            : "Copy Link";

  return (
    <Button size="sm" variant="primary" onClick={handleClick}>
      {buttonLabel}
    </Button>
  );
}
