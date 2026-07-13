import { Card } from "@/components/ui/card";
import type { StudentStreakSummary } from "@/lib/server/streaks";

export function StudentStreakCard({
  summary,
}: {
  summary: StudentStreakSummary | null;
}) {
  if (!summary) return null;

  return (
    <Card padding="sm" className="mb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted">Practice streak</div>
          <div className="text-2xl font-bold">
            {summary.currentStreak}
            <span className="text-sm font-normal text-muted ml-1">
              day{summary.currentStreak === 1 ? "" : "s"}
            </span>
          </div>
          <div className="text-xs text-muted mt-0.5">
            Longest: {summary.longestStreak} day
            {summary.longestStreak === 1 ? "" : "s"}
          </div>
        </div>
        {summary.badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-end max-w-md">
            {summary.badges.map((badge) => (
              <span
                key={badge.id}
                className="inline-flex items-center text-xs bg-surface-dim border border-border rounded-lg px-2.5 py-1"
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
