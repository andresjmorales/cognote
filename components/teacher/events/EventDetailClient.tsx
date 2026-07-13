"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  EventForm,
  type EventFormStudent,
  type EventFormValues,
} from "@/components/teacher/events/EventForm";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/events";
import type { RsvpStatus } from "@/lib/supabase/types";

const RSVP_LABELS: Record<RsvpStatus, string> = {
  pending: "Pending",
  yes: "Yes",
  no: "No",
  maybe: "Maybe",
};

export function EventDetailClient({
  eventId,
  title,
  description,
  location,
  startsAt,
  endsAt,
  students,
  allStudents,
  rsvps,
}: {
  eventId: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string | null;
  students: {
    studentId: string;
    name: string;
    repertoire: string;
  }[];
  allStudents: EventFormStudent[];
  rsvps: {
    id: string;
    guardianName: string;
    status: RsvpStatus;
    partySize: number | null;
    note: string;
  }[];
}) {
  const router = useRouter();
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const initial: EventFormValues = {
    title,
    startsAt: toDatetimeLocalValue(startsAt),
    endsAt: endsAt ? toDatetimeLocalValue(endsAt) : "",
    location,
    description,
    studentIds: students.map((s) => s.studentId),
    repertoireByStudent: Object.fromEntries(
      students.map((s) => [s.studentId, s.repertoire])
    ),
  };

  async function handleSave(values: EventFormValues) {
    const res = await fetch(`/api/events/${eventId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: values.title,
        description: values.description,
        location: values.location,
        startsAt: fromDatetimeLocalValue(values.startsAt),
        endsAt: values.endsAt
          ? fromDatetimeLocalValue(values.endsAt)
          : null,
        studentIds: values.studentIds,
        repertoireByStudent: values.repertoireByStudent,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error ?? "Failed to save event");
    }
    router.refresh();
  }

  async function handleEmail() {
    setEmailBusy(true);
    setEmailMessage(null);
    try {
      const res = await fetch(`/api/events/${eventId}/email`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEmailMessage(data.error ?? "Failed to send emails");
        return;
      }
      setEmailMessage(
        `Sent to ${data.sent} ${data.sent === 1 ? "family" : "families"}` +
          (data.skipped
            ? ` · skipped ${data.skipped} (no email or send failed)`
            : "")
      );
      router.refresh();
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.error ?? "Failed to delete event");
        setDeleting(false);
        return;
      }
      router.push("/events");
      router.refresh();
    } catch {
      alert("Failed to delete event");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-muted text-sm mt-1">Edit details, performers, and RSVPs.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleEmail}
            disabled={emailBusy || rsvps.length === 0}
          >
            {emailBusy ? "Sending…" : "Email families"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-error hover:bg-error/10 hover:text-error"
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      {emailMessage && (
        <p className="text-sm text-muted">{emailMessage}</p>
      )}

      <Card>
        <h2 className="font-semibold mb-4">Event details</h2>
        <EventForm
          key={`${eventId}-${startsAt}-${students.map((s) => s.studentId).join(",")}`}
          students={allStudents}
          initial={initial}
          submitLabel="Save changes"
          onSubmit={handleSave}
        />
      </Card>

      <Card>
        <h2 className="font-semibold mb-3">RSVPs</h2>
        {rsvps.length === 0 ? (
          <p className="text-sm text-muted">
            No families invited yet. Add performers with a family linked to create RSVPs.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-border">
                  <th className="py-2 pr-3 font-medium">Family</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Party size</th>
                  <th className="py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {rsvps.map((rsvp) => (
                  <tr key={rsvp.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3 font-medium">{rsvp.guardianName}</td>
                    <td className="py-2.5 pr-3">
                      {RSVP_LABELS[rsvp.status] ?? rsvp.status}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">
                      {rsvp.partySize ?? "—"}
                    </td>
                    <td className="py-2.5 text-muted">
                      {rsvp.note?.trim() || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !deleting && setConfirmDelete(false)}
        >
          <div
            className="bg-surface border border-border rounded-xl shadow-lg max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-lg mb-1">Delete event?</h3>
            <p className="text-muted text-sm mb-4">
              &quot;{title}&quot; and its RSVPs will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="error"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
