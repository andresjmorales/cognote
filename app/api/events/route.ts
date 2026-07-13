import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateEventEndAfterStart } from "@/lib/events";
import type { RsvpStatus } from "@/lib/supabase/types";

type EventCounts = {
  studentCount: number;
  rsvpCount: number;
  rsvpYesCount: number;
  rsvpPendingCount: number;
};

function countRsvps(
  rsvps: { status: RsvpStatus }[] | null | undefined
): Pick<EventCounts, "rsvpCount" | "rsvpYesCount" | "rsvpPendingCount"> {
  const list = rsvps ?? [];
  return {
    rsvpCount: list.length,
    rsvpYesCount: list.filter((r) => r.status === "yes").length,
    rsvpPendingCount: list.filter((r) => r.status === "pending").length,
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("events")
    .select(
      `
      id, title, description, location, starts_at, ends_at, created_at, updated_at,
      event_students ( id ),
      event_rsvps ( status )
    `
    )
    .eq("teacher_id", user.id)
    .order("starts_at", { ascending: false });

  if (error) {
    console.error("events list:", error);
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }

  const events = (data ?? []).map((row) => {
    const rsvpCounts = countRsvps(
      row.event_rsvps as { status: RsvpStatus }[] | null
    );
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      location: row.location,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      studentCount: (row.event_students as { id: string }[] | null)?.length ?? 0,
      ...rsvpCounts,
    };
  });

  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const startsAt =
    typeof body.startsAt === "string" ? body.startsAt.trim() : "";
  if (!startsAt || Number.isNaN(Date.parse(startsAt))) {
    return NextResponse.json(
      { error: "A valid start date/time is required" },
      { status: 400 }
    );
  }

  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const location =
    typeof body.location === "string" ? body.location.trim() : "";
  const endsAtRaw =
    typeof body.endsAt === "string" ? body.endsAt.trim() : "";
  const endsAt =
    endsAtRaw && !Number.isNaN(Date.parse(endsAtRaw)) ? endsAtRaw : null;

  const endOrderError = validateEventEndAfterStart(startsAt, endsAt);
  if (endOrderError) {
    return NextResponse.json({ error: endOrderError }, { status: 400 });
  }

  const studentIds: string[] = Array.isArray(body.studentIds)
    ? body.studentIds.filter((id: unknown): id is string => typeof id === "string")
    : [];
  const repertoireByStudent: Record<string, string> =
    body.repertoireByStudent &&
    typeof body.repertoireByStudent === "object" &&
    !Array.isArray(body.repertoireByStudent)
      ? body.repertoireByStudent
      : {};

  const { data: event, error: insertError } = await supabase
    .from("events")
    .insert({
      teacher_id: user.id,
      title,
      description,
      location,
      starts_at: startsAt,
      ends_at: endsAt,
    })
    .select("id, title, description, location, starts_at, ends_at, created_at, updated_at")
    .single();

  if (insertError || !event) {
    console.error("events insert:", insertError);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }

  if (studentIds.length > 0) {
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("id, guardian_id")
      .eq("teacher_id", user.id)
      .in("id", studentIds);

    if (studentsError) {
      console.error("events students lookup:", studentsError);
      return NextResponse.json(
        { error: "Failed to attach students" },
        { status: 500 }
      );
    }

    const owned = new Map(
      (students ?? []).map((s) => [s.id, s.guardian_id as string | null])
    );
    const orderedIds = studentIds.filter((id) => owned.has(id));

    if (orderedIds.length > 0) {
      const rows = orderedIds.map((studentId, index) => ({
        event_id: event.id,
        student_id: studentId,
        repertoire:
          typeof repertoireByStudent[studentId] === "string"
            ? repertoireByStudent[studentId].trim()
            : "",
        sort_order: index,
      }));

      const { error: esError } = await supabase
        .from("event_students")
        .insert(rows);
      if (esError) {
        console.error("event_students insert:", esError);
        return NextResponse.json(
          { error: "Failed to attach students" },
          { status: 500 }
        );
      }

      const guardianIds = Array.from(
        new Set(
          orderedIds
            .map((id) => owned.get(id))
            .filter((g): g is string => typeof g === "string" && g.length > 0)
        )
      );

      if (guardianIds.length > 0) {
        const { error: rsvpError } = await supabase.from("event_rsvps").upsert(
          guardianIds.map((guardian_id) => ({
            event_id: event.id,
            guardian_id,
            status: "pending" as const,
          })),
          { onConflict: "event_id,guardian_id", ignoreDuplicates: true }
        );
        if (rsvpError) {
          console.error("event_rsvps upsert:", rsvpError);
          return NextResponse.json(
            { error: "Failed to create RSVPs" },
            { status: 500 }
          );
        }
      }
    }
  }

  return NextResponse.json(
    {
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        location: event.location,
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        createdAt: event.created_at,
        updatedAt: event.updated_at,
      },
    },
    { status: 201 }
  );
}
