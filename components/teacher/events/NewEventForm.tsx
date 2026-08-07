"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import {
  EventForm,
  type EventFormStudent,
  type EventFormValues,
} from "@/components/teacher/events/EventForm";
import { fromDatetimeLocalValue } from "@/lib/events";

export function NewEventForm({
  students,
  initialStartsAt,
}: {
  students: EventFormStudent[];
  initialStartsAt: string;
}) {
  const router = useRouter();

  async function handleSubmit(values: EventFormValues) {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: values.title,
        description: values.description || undefined,
        location: values.location || undefined,
        startsAt: fromDatetimeLocalValue(values.startsAt),
        endsAt: values.endsAt
          ? fromDatetimeLocalValue(values.endsAt)
          : undefined,
        sendReminder: values.sendReminder,
        studentIds: values.studentIds,
        repertoireByStudent: values.repertoireByStudent,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error ?? "Failed to create event");
    }
    router.push(`/events/${data.event.id}`);
    router.refresh();
  }

  return (
    <Card>
      <EventForm
        students={students}
        initial={{
          title: "",
          startsAt: initialStartsAt,
          endsAt: "",
          location: "",
          description: "",
          sendReminder: false,
          studentIds: [],
          repertoireByStudent: {},
        }}
        submitLabel="Create event"
        onSubmit={handleSubmit}
      />
    </Card>
  );
}
