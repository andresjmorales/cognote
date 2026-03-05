"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { shareOrCopyUrl } from "@/lib/shareOrCopy";

interface Plan {
  id: string;
  name: string;
}

export function AssignPlanToStudentButton({
  studentId,
  studentName,
  plans,
}: {
  studentId: string;
  studentName: string;
  plans: Plan[];
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

  async function handleAssign(planId: string, planName: string) {
    setAssigning(true);

    try {
      const res = await fetch(`/api/plans/${planId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setToast(err?.error ?? "Failed to assign lesson");
        setTimeout(() => setToast(null), 4000);
        setAssigning(false);
        setOpen(false);
        return;
      }

      const data = await res.json();
      const fullUrl = `${window.location.origin}/practice/${data.token}`;

      const result = await shareOrCopyUrl(fullUrl, {
        title: "Practice link",
        text: `Practice link: ${planName}`,
      });
      if (result.method === "share") {
        setToast(`"${planName}" assigned! Choose how to share (e.g. Copy or Messages).`);
      } else if (result.method === "copy") {
        setToast(`"${planName}" assigned! Link copied.`);
      } else {
        setToast(`"${planName}" assigned! Link: ${fullUrl}`);
      }
      setTimeout(() => setToast(null), 5000);
      router.refresh();
    } catch {
      setToast("Failed to assign lesson");
      setTimeout(() => setToast(null), 4000);
    }

    setAssigning(false);
    setOpen(false);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button size="sm" onClick={() => setOpen(!open)}>
        Assign Lesson
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-10 w-64 max-h-64 overflow-y-auto">
          {plans.length === 0 ? (
            <div className="p-3 text-sm text-muted">No lessons yet</div>
          ) : (
            plans.map((p) => (
              <button
                key={p.id}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-dim transition-colors first:rounded-t-lg last:rounded-b-lg cursor-pointer"
                onClick={() => handleAssign(p.id, p.name)}
                disabled={assigning}
              >
                {p.name}
              </button>
            ))
          )}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 bg-primary text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
