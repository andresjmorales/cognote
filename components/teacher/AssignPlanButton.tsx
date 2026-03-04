"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface Student {
  id: string;
  name: string;
}

export function AssignPlanButton({
  planId,
  students,
}: {
  planId: string;
  students: Student[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
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

  async function handleAssign(studentId: string, studentName: string) {
    setAssigning(true);

    try {
      const res = await fetch(`/api/plans/${planId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setToast(err?.error ?? "Failed to assign lesson plan");
        setTimeout(() => setToast(null), 4000);
        setAssigning(false);
        setOpen(false);
        return;
      }

      const data = await res.json();
      const fullUrl = `${window.location.origin}/practice/${data.token}`;

      try {
        await navigator.clipboard.writeText(fullUrl);
        setToast(`Link copied! Send to ${studentName}'s parent.`);
      } catch {
        setToast(`Assigned! Link: ${fullUrl}`);
      }
      setTimeout(() => setToast(null), 5000);
      router.refresh();
    } catch {
      setToast("Failed to assign lesson plan");
      setTimeout(() => setToast(null), 4000);
    }

    setAssigning(false);
    setOpen(false);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button size="sm" variant="secondary" onClick={() => setOpen(!open)}>
        Assign
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-10 w-48">
          {students.length === 0 ? (
            <div className="p-3 text-sm text-muted">No students yet</div>
          ) : (
            students.map((s) => (
              <button
                key={s.id}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-dim transition-colors first:rounded-t-lg last:rounded-b-lg cursor-pointer"
                onClick={() => handleAssign(s.id, s.name)}
                disabled={assigning}
              >
                {s.name}
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
