"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Student {
  id: string;
  name: string;
}

export function LaunchPlanButton({
  planId,
  planName,
  students,
}: {
  planId: string;
  planName: string;
  students: Student[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLaunch(studentId: string, studentName: string) {
    setLaunching(true);

    // Open the window synchronously before any async work so Safari doesn't block it as a popup
    const newWindow = window.open("", "_blank");

    try {
      const res = await fetch(`/api/lessons/${planId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        newWindow?.close();
        setToast(err?.error ?? "Failed to launch lesson");
        setTimeout(() => setToast(null), 4000);
        setLaunching(false);
        setOpen(false);
        return;
      }

      const data = await res.json();
      if (newWindow) newWindow.location.href = `/practice/${data.token}?back=/students/${studentId}`;
      setToast(`Launched "${planName}" for ${studentName}.`);
      setTimeout(() => setToast(null), 4000);
      router.refresh();
    } catch {
      newWindow?.close();
      setToast("Failed to launch lesson");
      setTimeout(() => setToast(null), 4000);
    }

    setLaunching(false);
    setOpen(false);
  }

  function handlePreviewClick() {
    setToast(`Previewing "${planName}".`);
    setTimeout(() => setToast(null), 4000);
    setOpen(false);
  }

  return (
    <div
      className="relative"
      ref={dropdownRef}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => setOpen(!open)}
      >
        Launch
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-10 w-56">
          <a
            href={`/lessons/${planId}/preview`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-left px-3 py-2 text-sm hover:bg-surface-dim active:bg-border transition-colors rounded-t-lg cursor-pointer"
            onClick={handlePreviewClick}
          >
            Preview lesson
          </a>
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted border-t border-border">
            Launch for...
          </div>
          {students.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted rounded-b-lg">
              No students yet
            </div>
          ) : (
            students.map((student, index) => (
              <button
                key={student.id}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-dim active:bg-border transition-colors cursor-pointer ${
                  index === students.length - 1 ? "rounded-b-lg" : ""
                }`}
                onClick={() => handleLaunch(student.id, student.name)}
                disabled={launching}
              >
                {student.name}
              </button>
            ))
          )}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 bg-primary text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50 animate-[fadeIn_0.2s]">
          {toast}
        </div>
      )}
    </div>
  );
}
