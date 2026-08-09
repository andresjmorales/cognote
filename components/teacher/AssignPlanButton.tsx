"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { shareOrCopyUrl } from "@/lib/shareOrCopy";

interface Student {
  id: string;
  name: string;
  assigned?: boolean;
}

export function AssignPlanButton({
  planId,
  students,
}: {
  planId: string;
  students: Student[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
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
      const res = await fetch(`/api/lessons/${planId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, notifyFamily: true }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        showToast(err?.error ?? "Failed to assign lesson", "error");
        setAssigning(false);
        setOpen(false);
        return;
      }

      const data = await res.json();

      if (data.alreadyAssigned) {
        showToast(`"${studentName}" already has this lesson.`, "info");
      } else if (data.emailed) {
        showToast(`Assigned to ${studentName}! Emailed the family.`);
      } else {
        // No family email on file (or email not configured) — fall back to
        // the native share sheet / clipboard.
        const fullUrl = `${window.location.origin}/practice/${data.token}`;
        const result = await shareOrCopyUrl(fullUrl, {
          title: "Practice link",
          text: `Practice link for ${studentName}`,
        });
        if (result.method === "share") {
          showToast(`Assigned to ${studentName}! Link shared.`);
        } else if (result.method === "copy") {
          showToast(`Assigned to ${studentName}! Link copied.`);
        } else {
          showToast(`Assigned to ${studentName}! Link: ${fullUrl}`);
        }
      }
      router.refresh();
    } catch {
      showToast("Failed to assign lesson", "error");
    }

    setAssigning(false);
    setOpen(false);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button size="sm" variant="primary" onClick={() => setOpen(!open)}>
        Assign
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-10 w-48 max-w-[calc(100vw-1.5rem)] max-h-64 overflow-y-auto">
          {students.length === 0 ? (
            <div className="p-3 text-sm text-muted">No students yet</div>
          ) : (
            students.map((s) => (
              <button
                key={s.id}
                className={`w-full text-left px-3 py-2 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  s.assigned
                    ? "text-muted bg-surface-dim/50 cursor-not-allowed"
                    : "hover:bg-surface-dim active:bg-border cursor-pointer"
                }`}
                onClick={() => handleAssign(s.id, s.name)}
                disabled={assigning || s.assigned}
                title={s.assigned ? "Already assigned" : undefined}
              >
                {s.name}
                {s.assigned && (
                  <span className="block text-xs text-muted">Already assigned</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
