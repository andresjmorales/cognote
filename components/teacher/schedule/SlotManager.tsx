"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { centsToDollarsInput, dollarsToCents } from "@/lib/billing";

interface Slot {
  id: string;
  student_id: string;
  studentName: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  end_date: string | null;
  active: boolean;
  rate_cents: number | null;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm";

export function SlotManager({
  slots,
  students,
  durationOptions,
}: {
  slots: Slot[];
  students: { id: string; name: string }[];
  durationOptions: number[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [dayOfWeek, setDayOfWeek] = useState(2);
  const [startTime, setStartTime] = useState("16:00");
  const [duration, setDuration] = useState(durationOptions[0] ?? 30);
  const [rateDollars, setRateDollars] = useState("");

  function startEdit(slot: Slot) {
    setAdding(false);
    setEditingId(slot.id);
    setDayOfWeek(slot.day_of_week);
    setStartTime(slot.start_time.slice(0, 5));
    setDuration(slot.duration_minutes);
    setRateDollars(centsToDollarsInput(slot.rate_cents));
    setError(null);
  }

  function parseRate(): number | null | undefined {
    if (rateDollars.trim() === "") return null;
    const cents = dollarsToCents(rateDollars);
    if (cents === null) return undefined;
    return cents;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const rateCents = parseRate();
    if (rateCents === undefined) {
      setError("Enter a valid rate (e.g. 45.00) or leave blank");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/schedule/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        dayOfWeek,
        startTime,
        durationMinutes: duration,
        rateCents,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setAdding(false);
      setRateDollars("");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to add slot");
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const rateCents = parseRate();
    if (rateCents === undefined) {
      setError("Enter a valid rate (e.g. 45.00) or leave blank");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/schedule/slots/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayOfWeek,
        startTime,
        durationMinutes: duration,
        rateCents,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setEditingId(null);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update slot");
    }
  }

  async function toggleActive(slot: Slot) {
    setBusy(true);
    await fetch(`/api/schedule/slots/${slot.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !slot.active }),
    });
    setBusy(false);
    router.refresh();
  }

  async function handleDelete(slot: Slot) {
    const ok = await confirm({
      title: "Delete slot?",
      message: `Delete ${slot.studentName}'s ${DAY_NAMES[slot.day_of_week]} slot? Past lessons are kept; upcoming unmarked ones are removed.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    setBusy(true);
    await fetch(`/api/schedule/slots/${slot.id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  const dayTimeDurationFields = (
    <div className="grid grid-cols-3 gap-3">
      <select
        value={dayOfWeek}
        onChange={(e) => setDayOfWeek(Number(e.target.value))}
        className={inputClass}
      >
        {DAY_NAMES.map((day, i) => (
          <option key={day} value={i}>
            {day}
          </option>
        ))}
      </select>
      <input
        type="time"
        value={startTime}
        onChange={(e) => setStartTime(e.target.value)}
        className={inputClass}
        required
      />
      <select
        value={duration}
        onChange={(e) => setDuration(Number(e.target.value))}
        className={inputClass}
      >
        {durationOptions.map((minutes) => (
          <option key={minutes} value={minutes}>
            {minutes} min
          </option>
        ))}
      </select>
    </div>
  );

  const rateField = (
    <label className="text-sm">
      <span className="block text-xs font-semibold text-muted mb-1">
        Lesson rate (optional)
      </span>
      <div className="flex items-center gap-2">
        <span className="text-muted text-sm">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={rateDollars}
          onChange={(e) => setRateDollars(e.target.value)}
          placeholder="Studio default if blank"
          className={inputClass}
        />
      </div>
    </label>
  );

  return (
    <Card padding="sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Weekly Slots</h2>
        {!adding && !editingId && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setAdding(true);
              setRateDollars("");
              setError(null);
            }}
          >
            Add Slot
          </Button>
        )}
      </div>

      {adding && (
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 mb-4 pb-4 border-b border-border"
        >
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className={inputClass}
            required
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {dayTimeDurationFields}
          {rateField}
          {error && <p className="text-error text-xs">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy || !studentId}>
              {busy ? "Adding..." : "Add Slot"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setAdding(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {slots.length === 0 ? (
        <p className="text-sm text-muted">
          No recurring slots yet. Add one and lessons appear on the schedule
          automatically, week after week.
        </p>
      ) : (
        <div className="space-y-2">
          {slots.map((slot) =>
            editingId === slot.id ? (
              <form
                key={slot.id}
                onSubmit={handleEdit}
                className="flex flex-col gap-3 py-2 px-3 -mx-1 rounded-lg border border-primary/40 bg-primary/5"
              >
                <div className="text-sm font-medium">
                  Edit {slot.studentName}&apos;s slot
                </div>
                {dayTimeDurationFields}
                {rateField}
                <p className="text-xs text-muted">
                  Applies to upcoming lessons only. Past lessons and marked
                  attendance stay where they are.
                </p>
                {error && <p className="text-error text-xs">{error}</p>}
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={busy}>
                    {busy ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div
                key={slot.id}
                className={`flex items-center justify-between gap-2 text-sm ${
                  slot.active ? "" : "opacity-50"
                }`}
              >
                <div>
                  <span className="font-medium">{slot.studentName}</span>{" "}
                  <span className="text-muted">
                    · {DAY_NAMES[slot.day_of_week]}s{" "}
                    {formatTime(slot.start_time)} · {slot.duration_minutes} min
                    {slot.rate_cents != null &&
                      ` · $${(slot.rate_cents / 100).toFixed(2)}`}
                    {!slot.active && " · paused"}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(slot)}
                    disabled={busy}
                    className="text-xs text-muted hover:text-foreground underline cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleActive(slot)}
                    disabled={busy}
                    className="text-xs text-muted hover:text-foreground underline cursor-pointer"
                  >
                    {slot.active ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => handleDelete(slot)}
                    disabled={busy}
                    className="text-xs text-error hover:underline cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </Card>
  );
}

function formatTime(time: string): string {
  const [hh, mm] = time.split(":").map(Number);
  const period = hh >= 12 ? "PM" : "AM";
  const hour = hh % 12 === 0 ? 12 : hh % 12;
  return `${hour}:${String(mm).padStart(2, "0")} ${period}`;
}
