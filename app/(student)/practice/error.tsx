"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Kid-friendly crash screen for the practice experience. */
export default function PracticeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Practice page crashed:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-[family-name:var(--font-nunito)]">
      <Card padding="lg" className="max-w-sm w-full text-center">
        <div className="text-5xl mb-4">🎹</div>
        <h1 className="text-2xl font-bold mb-2">Oops, a wrong note!</h1>
        <p className="text-muted mb-6">
          Something went wrong with your practice page. Let&apos;s try that
          again.
        </p>
        <Button size="lg" onClick={reset} className="w-full">
          Try Again
        </Button>
      </Card>
    </div>
  );
}
