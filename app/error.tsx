"use client";

import Link from "next/link";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center">
        <img
          src="/icon/cognote.svg"
          alt="CogNote"
          width={64}
          height={64}
          className="mx-auto mb-6"
        />
        <h1 className="text-2xl font-bold mb-2">Something went wrong 😕</h1>
        <p className="text-muted mb-6">
          An unexpected error occurred. Please try again.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="bg-primary text-white rounded-lg px-6 py-2.5 text-sm font-semibold hover:bg-primary-dark transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="border border-border rounded-lg px-6 py-2.5 text-sm font-semibold hover:bg-surface-dim transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
