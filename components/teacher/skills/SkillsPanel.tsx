"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface Dimension {
  id: string;
  name: string;
  sort_order: number;
}

export interface Assessment {
  id: string;
  dimension_id: string;
  rating: number;
  assessed_on: string; // YYYY-MM-DD
  created_at: string;
}

const LINE_COLORS = [
  "#2a9d8f", // primary teal
  "#d4a843", // accent gold
  "#e07a6a", // coral
  "#5b8dd4", // blue
  "#8e7cc3", // purple
  "#6bcb77", // green
  "#e0995e", // orange
  "#c95d8f", // pink
];

function formatShortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function SkillsPanel({
  studentId,
  dimensions,
  assessments,
}: {
  studentId: string;
  dimensions: Dimension[];
  assessments: Assessment[];
}) {
  const router = useRouter();
  const [rating, setRating] = useState(false);
  const [managing, setManaging] = useState(false);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dimensionById = useMemo(
    () => new Map(dimensions.map((d) => [d.id, d])),
    [dimensions]
  );

  // Latest rating per dimension (assessments arrive sorted by assessed_on,
  // created_at ascending — last write wins).
  const latest = useMemo(() => {
    const map = new Map<string, Assessment>();
    for (const a of assessments) {
      if (dimensionById.has(a.dimension_id)) map.set(a.dimension_id, a);
    }
    return map;
  }, [assessments, dimensionById]);

  const radarData = useMemo(
    () =>
      dimensions.map((d) => ({
        skill: d.name,
        rating: latest.get(d.id)?.rating ?? 0,
      })),
    [dimensions, latest]
  );

  // One trend point per assessment date; each dimension is a line.
  const trendData = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    for (const a of assessments) {
      const dim = dimensionById.get(a.dimension_id);
      if (!dim) continue;
      const row = byDate.get(a.assessed_on) ?? { date: a.assessed_on };
      row[dim.name] = a.rating;
      byDate.set(a.assessed_on, row);
    }
    return [...byDate.values()].sort((a, b) =>
      String(a.date) < String(b.date) ? -1 : 1
    );
  }, [assessments, dimensionById]);

  const hasRatings = latest.size > 0;
  const hasTrend = trendData.length >= 2;

  function startRating() {
    // Pre-fill with the latest known ratings so the teacher adjusts, not re-enters.
    const initial: Record<string, number> = {};
    for (const d of dimensions) {
      const prev = latest.get(d.id);
      if (prev) initial[d.id] = prev.rating;
    }
    setDraft(initial);
    setError(null);
    setRating(true);
  }

  async function saveRatings() {
    const ratings = Object.entries(draft).map(([dimensionId, value]) => ({
      dimensionId,
      rating: value,
    }));
    if (ratings.length === 0) {
      setRating(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${studentId}/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratings }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setError(err?.error ?? "Failed to save ratings");
        setSaving(false);
        return;
      }
      setRating(false);
      router.refresh();
    } catch {
      setError("Failed to save ratings");
    }
    setSaving(false);
  }

  return (
    <Card padding="sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Skills</h3>
        <div className="flex items-center gap-2">
          <button
            className="text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
            onClick={() => setManaging(!managing)}
          >
            {managing ? "Done" : "Edit Skills"}
          </button>
          {!rating && (
            <Button size="sm" variant="secondary" onClick={startRating}>
              Rate Skills
            </Button>
          )}
        </div>
      </div>

      {managing && (
        <ManageDimensions dimensions={dimensions} onChanged={() => router.refresh()} />
      )}

      {rating ? (
        <div className="space-y-3">
          {dimensions.map((d) => (
            <div
              key={d.id}
              className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3"
            >
              <span className="text-sm w-32 shrink-0">{d.name}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    onClick={() =>
                      setDraft((prev) => {
                        const next = { ...prev };
                        if (next[d.id] === v) delete next[d.id];
                        else next[d.id] = v;
                        return next;
                      })
                    }
                    className={`w-9 h-9 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
                      draft[d.id] === v
                        ? "bg-primary text-white border-primary"
                        : "bg-surface border-border hover:bg-surface-dim"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted">
            1 = emerging · 5 = mastered. Skip skills you didn&apos;t assess today.
          </p>
          {error && <p className="text-xs text-error">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={saveRatings} disabled={saving}>
              {saving ? "Saving..." : "Save Ratings"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRating(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : !hasRatings ? (
        <p className="text-sm text-muted text-center py-6">
          No skill ratings yet. Tap &quot;Rate Skills&quot; after a lesson to start
          tracking progress.
        </p>
      ) : (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="#e5e2dc" />
                <PolarAngleAxis
                  dataKey="skill"
                  tick={{ fontSize: 11, fill: "#6b6b7b" }}
                />
                <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={false} axisLine={false} />
                <Radar
                  dataKey="rating"
                  stroke="#2a9d8f"
                  fill="#2a9d8f"
                  fillOpacity={0.35}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {hasTrend && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                Over Time
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 4, right: 8, left: -28 }}>
                    <CartesianGrid stroke="#e5e2dc" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatShortDate}
                      tick={{ fontSize: 11, fill: "#6b6b7b" }}
                    />
                    <YAxis
                      domain={[0, 5]}
                      tickCount={6}
                      tick={{ fontSize: 11, fill: "#6b6b7b" }}
                    />
                    <Tooltip labelFormatter={(v) => formatShortDate(String(v))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {dimensions.map((d, i) => (
                      <Line
                        key={d.id}
                        type="monotone"
                        dataKey={d.name}
                        stroke={LINE_COLORS[i % LINE_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function ManageDimensions({
  dimensions,
  onChanged,
}: {
  dimensions: Dimension[];
  onChanged: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addDimension() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/skills/dimensions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      setError(err?.error ?? "Failed to add skill");
    } else {
      setNewName("");
      onChanged();
    }
    setBusy(false);
  }

  async function removeDimension(d: Dimension) {
    if (
      !confirm(
        `Delete "${d.name}"? All of its ratings (for every student) will be deleted too.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/skills/dimensions/${d.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      setError(err?.error ?? "Failed to delete skill");
    } else {
      onChanged();
    }
    setBusy(false);
  }

  return (
    <div className="mb-4 p-3 rounded-lg bg-surface-dim/60 border border-border">
      <p className="text-xs text-muted mb-2">
        Skills are shared across all your students.
      </p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {dimensions.map((d) => (
          <span
            key={d.id}
            className="inline-flex items-center gap-1 text-xs bg-surface border border-border rounded-full px-2.5 py-1"
          >
            {d.name}
            <button
              onClick={() => removeDimension(d)}
              disabled={busy}
              className="text-muted hover:text-error transition-colors cursor-pointer"
              aria-label={`Delete ${d.name}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addDimension()}
          placeholder="Add a skill (e.g. Ear Training)"
          className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
        />
        <Button size="sm" variant="secondary" onClick={addDimension} disabled={busy}>
          Add
        </Button>
      </div>
      {error && <p className="text-xs text-error mt-1">{error}</p>}
    </div>
  );
}
