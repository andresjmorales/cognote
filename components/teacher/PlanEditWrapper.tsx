"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlanEditor } from "./PlanEditor";

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
  };
  children: (editButton: React.ReactNode) => React.ReactNode;
}

export function PlanEditWrapper({
  planId,
  initialData,
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

  const editButton = (
    <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
      Edit Lesson
    </Button>
  );

  return (
    <div>
      {children(editButton)}
    </div>
  );
}
