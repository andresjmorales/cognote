"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyLinkClient({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const fullUrl = `${window.location.origin}${url}`;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button size="sm" variant="secondary" onClick={handleCopy}>
      {copied ? "Copied!" : "Copy Link"}
    </Button>
  );
}
