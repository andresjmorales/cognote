"use client";

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
import type { Dimension } from "./SkillsPanel";

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

/**
 * Recharts views for the Skills panel. Kept in a separate module so the
 * charting library is only downloaded when a student actually has ratings.
 */
export default function SkillsCharts({
  radarData,
  trendData,
  dimensions,
  hasTrend,
}: {
  radarData: { skill: string; rating: number }[];
  trendData: Record<string, number | string>[];
  dimensions: Dimension[];
  hasTrend: boolean;
}) {
  return (
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
  );
}
