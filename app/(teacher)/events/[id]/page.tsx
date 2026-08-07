import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { familyDisplayName } from "@/lib/guardians";
import { oneToOne } from "@/lib/schedule";
import { EventDetailClient } from "@/components/teacher/events/EventDetailClient";
import type { RsvpStatus } from "@/lib/supabase/types";

export const metadata = { title: "Event" };

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: event }, { data: allStudents }] = await Promise.all([
    supabase
      .from("events")
      .select(
        `
        id, title, description, location, starts_at, ends_at,
        send_reminder, reminder_sent_at,
        event_students (
          student_id, repertoire, sort_order,
          students ( id, name )
        ),
        event_rsvps (
          id, status, party_size, note,
          guardians ( id, name, family_name )
        )
      `
      )
      .eq("id", id)
      .eq("teacher_id", user.id)
      .maybeSingle(),
    supabase
      .from("students")
      .select("id, name")
      .eq("teacher_id", user.id)
      .order("name"),
  ]);

  if (!event) notFound();

  const students = (
    (event.event_students as {
      student_id: string;
      repertoire: string;
      sort_order: number;
      students: { id: string; name: string } | { id: string; name: string }[] | null;
    }[]) ?? []
  )
    .map((row) => {
      const student = oneToOne(row.students);
      return {
        studentId: row.student_id,
        name: student?.name ?? "Student",
        repertoire: row.repertoire,
        sortOrder: row.sort_order,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const rsvps = (
    (event.event_rsvps as {
      id: string;
      status: RsvpStatus;
      party_size: number | null;
      note: string;
      guardians:
        | { id: string; name: string; family_name: string | null }
        | { id: string; name: string; family_name: string | null }[]
        | null;
    }[]) ?? []
  ).map((row) => {
    const guardian = oneToOne(row.guardians);
    return {
      id: row.id,
      guardianName: guardian ? familyDisplayName(guardian) : "Family",
      status: row.status,
      partySize: row.party_size,
      note: row.note,
    };
  });

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/events"
        className="text-sm text-muted hover:text-foreground transition-colors"
      >
        ← Events
      </Link>
      <div className="mt-4">
        <EventDetailClient
          eventId={event.id}
          title={event.title}
          description={event.description}
          location={event.location}
          startsAt={event.starts_at}
          endsAt={event.ends_at}
          sendReminder={event.send_reminder}
          reminderSentAt={event.reminder_sent_at}
          students={students}
          allStudents={allStudents ?? []}
          rsvps={rsvps}
        />
      </div>
    </div>
  );
}
