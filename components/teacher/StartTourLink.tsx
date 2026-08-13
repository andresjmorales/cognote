"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TOUR_START_EVENT, TOUR_STORAGE_KEY } from "@/lib/onboarding";

function markTourRestart() {
  try {
    sessionStorage.setItem(
      TOUR_STORAGE_KEY,
      JSON.stringify({ active: true, stepIndex: 0, restart: true })
    );
  } catch {
    /* private mode / blocked storage */
  }
  window.dispatchEvent(new Event(TOUR_START_EVENT));
}

export function StartTourLink({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <Link
      href="/dashboard?tour=1"
      className={className}
      onClick={(e) => {
        markTourRestart();
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
          return;
        }
        e.preventDefault();
        router.push("/dashboard");
      }}
    >
      Take a short tour of the tabs
    </Link>
  );
}
