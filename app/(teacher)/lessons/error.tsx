"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function LessonsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Lessons page crashed:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center py-16 px-4">
      <Card padding="lg" className="max-w-md w-full text-center">
        <h1 className="text-xl font-semibold mb-2">
          Something went wrong loading your lessons
        </h1>
        <p className="text-sm text-muted mb-6">
          This is usually temporary. Try again, or head back to the dashboard.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset}>Try Again</Button>
          <Link href="/dashboard">
            <Button variant="secondary">Dashboard</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
