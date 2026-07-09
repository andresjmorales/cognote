"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { shareOrCopyUrl } from "@/lib/shareOrCopy";

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
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

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
