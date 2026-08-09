"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";

type SessionRow = {
  id: string;
  mode: string | null;
  started_at: string;
  total_correct: number;
  total_questions: number;
  plan?: { name?: string | null } | null;
};

const PREVIEW_COUNT = 5;

export function RecentSessionsList({ sessions }: { sessions: SessionRow[] }) {
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(
    () =>
      [...sessions].sort(
        (a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      ),
    [sessions]
  );

  const visible = expanded ? sorted : sorted.slice(0, PREVIEW_COUNT);
  const hiddenCount = sorted.length - PREVIEW_COUNT;

  if (sorted.length === 0) {
    return (
      <>
        <h2 className="text-lg font-semibold mb-3 mt-6">Recent Sessions</h2>
        <Card className="text-center text-muted">
          <p>No sessions yet.</p>
        </Card>
      </>
    );
  }

  return (
    <>
      <h2 className="text-lg font-semibold mb-3 mt-6">Recent Sessions</h2>
      <div className="space-y-2">
        {visible.map((s) => {
          const pct =
            s.total_questions > 0
              ? Math.round((s.total_correct / s.total_questions) * 100)
              : 0;
          return (
            <Card key={s.id} padding="sm">
              <div className="flex justify-between text-sm">
                <div>
                  <span className="capitalize">
                    {(s.mode ?? "practice").replace("_", " ")}
                  </span>
                  {s.plan?.name && (
                    <span className="text-muted ml-2">· {s.plan.name}</span>
                  )}
                  <span className="text-muted ml-2">
                    {s.total_correct}/{s.total_questions}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      pct >= 80
                        ? "text-success font-medium"
                        : pct >= 50
                          ? "text-warning font-medium"
                          : "text-error font-medium"
                    }
                  >
                    {pct}%
                  </span>
                  <span className="text-muted text-xs">
                    {new Date(s.started_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-sm text-primary hover:underline cursor-pointer"
          >
            {expanded ? "Show less" : `Show more (${hiddenCount})`}
          </button>
        )}
      </div>
    </>
  );
}
