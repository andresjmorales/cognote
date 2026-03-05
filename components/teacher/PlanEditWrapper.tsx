"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlanEditor } from "./PlanEditor";
import type { KeySigScaleMode } from "@/lib/music";

interface PlanEditWrapperProps {
  planId: string;
  initialData: {
    name: string;
    is_template: boolean;
    plan_type: string;
    clef: "treble" | "bass" | "both";
    key_signature: string;
    include_sharps: boolean;
    include_flats: boolean;
    measures_shown: number;
    questions_per_lesson: number;
    answer_choices: number;
    notes: string[];
    symbols: any[];
    difficulty: string;
    teacher_notes: string;
    show_hints: boolean;
    key_sig_scale_mode?: KeySigScaleMode;
    key_signatures?: string[];
  };
  actionSlot?: React.ReactNode;
  children: React.ReactNode;
}

export function PlanEditWrapper({
  planId,
  initialData,
  actionSlot,
  children,
}: PlanEditWrapperProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Edit Lesson</h1>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
        <PlanEditor mode="edit" planId={planId} initialData={initialData} />
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-end gap-2 mb-2">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Edit Lesson
          </Button>
          {actionSlot}
        </div>
      </div>
      {children}
    </div>
  );
}
