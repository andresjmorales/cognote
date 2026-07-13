import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { familyDisplayName } from "@/lib/guardians";
import { oneToOne } from "@/lib/schedule";
import { validateEventEndAfterStart } from "@/lib/events";

async function replaceEventStudents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teacherId: string,
  eventId: string,
  studentIds: string[],
  repertoireByStudent: Record<string, string>
): Promise<{ ok: true; guardianIds: string[] } | { ok: false; error: string }> {
  const { error: deleteError } = await supabase
    .from("event_students")
    .delete()
    .eq("event_id", eventId);
  if (deleteError) {
    console.error("event_students delete:", deleteError);
    return { ok: false, error: "Failed to update performers" };
  }

  if (studentIds.length === 0) {
    return { ok: true, guardianIds: [] };
  }

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, guardian_id")
    .eq("teacher_id", teacherId)
    .in("id", studentIds);

  if (studentsError) {
    console.error("event students lookup:", studentsError);
    return { ok: false, error: "Failed to update performers" };
  }

  const owned = new Map(
    (students ?? []).map((s) => [s.id, s.guardian_id as string | null])
  );
  const orderedIds = studentIds.filter((id) => owned.has(id));

  if (orderedIds.length > 0) {
    const rows = orderedIds.map((studentId, index) => ({
      event_id: eventId,
      student_id: studentId,
      repertoire:
        typeof repertoireByStudent[studentId] === "string"
          ? repertoireByStudent[studentId].trim()
          : "",
      sort_order: index,
    }));

    const { error: insertError } = await supabase
      .from("event_students")
      .insert(rows);
    if (insertError) {
      console.error("event_students insert:", insertError);
      return { ok: false, error: "Failed to update performers" };
    }
  }

  const guardianIds = Array.from(
    new Set(
      orderedIds
        .map((id) => owned.get(id))
        .filter((g): g is string => typeof g === "string" && g.length > 0)
    )
  );

  return { ok: true, guardianIds };
}

async function syncEventRsvps(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  guardianIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: existing, error: existingError } = await supabase
    .from("event_rsvps")
    .select("id, guardian_id")
    .eq("event_id", eventId);

  if (existingError) {
    console.error("event_rsvps list:", existingError);
    return { ok: false, error: "Failed to sync RSVPs" };
  }

  const keep = new Set(guardianIds);
  const existingIds = new Set((existing ?? []).map((r) => r.guardian_id));
  const toRemove = (existing ?? [])
    .filter((r) => !keep.has(r.guardian_id))
    .map((r) => r.id);
  const toAdd = guardianIds.filter((id) => !existingIds.has(id));

  if (toRemove.length > 0) {
    const { error: removeError } = await supabase
      .from("event_rsvps")
      .delete()
      .in("id", toRemove);
    if (removeError) {
      console.error("event_rsvps remove:", removeError);
      return { ok: false, error: "Failed to sync RSVPs" };
    }
  }

  if (toAdd.length > 0) {
    const { error: addError } = await supabase.from("event_rsvps").insert(
      toAdd.map((guardian_id) => ({
        event_id: eventId,
        guardian_id,
        status: "pending" as const,
      }))
    );
    if (addError) {
      console.error("event_rsvps add:", addError);
      return { ok: false, error: "Failed to sync RSVPs" };
    }
  }

  return { ok: true };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: event, error } = await supabase
    .from("events")
    .select(
      `
      id, title, description, location, starts_at, ends_at, created_at, updated_at,
      event_students (
        id, student_id, repertoire, sort_order,
        students ( id, name )
      ),
      event_rsvps (
        id, guardian_id, status, party_size, note, responded_at,
        guardians ( id, name, family_name )
      )
    `
    )
    .eq("id", id)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("event get:", error);
    return NextResponse.json({ error: "Failed to load event" }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const students = (
    (event.event_students as {
      id: string;
      student_id: string;
      repertoire: string;
      sort_order: number;
      students: { id: string; name: string } | { id: string; name: string }[] | null;
    }[]) ?? []
  )
    .map((row) => {
      const student = oneToOne(row.students);
      return {
        id: row.id,
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
      guardian_id: string;
      status: string;
      party_size: number | null;
      note: string;
      responded_at: string | null;
      guardians:
        | { id: string; name: string; family_name: string | null }
        | { id: string; name: string; family_name: string | null }[]
        | null;
    }[]) ?? []
  ).map((row) => {
    const guardian = oneToOne(row.guardians);
    return {
      id: row.id,
      guardianId: row.guardian_id,
      guardianName: guardian ? familyDisplayName(guardian) : "Family",
      status: row.status,
      partySize: row.party_size,
      note: row.note,
      respondedAt: row.responded_at,
    };
  });

  return NextResponse.json({
    event: {
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
      students,
      rsvps,
    },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from("events")
    .select("id, starts_at, ends_at")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    updates.title = title;
  }
  if (typeof body.description === "string") {
    updates.description = body.description.trim();
  }
  if (typeof body.location === "string") {
    updates.location = body.location.trim();
  }
  if (typeof body.startsAt === "string") {
    const startsAt = body.startsAt.trim();
    if (!startsAt || Number.isNaN(Date.parse(startsAt))) {
      return NextResponse.json(
        { error: "A valid start date/time is required" },
        { status: 400 }
      );
    }
    updates.starts_at = startsAt;
  }
  if (body.endsAt === null) {
    updates.ends_at = null;
  } else if (typeof body.endsAt === "string") {
    const endsAt = body.endsAt.trim();
    updates.ends_at =
      endsAt && !Number.isNaN(Date.parse(endsAt)) ? endsAt : null;
  }

  const nextStartsAt =
    typeof updates.starts_at === "string"
      ? updates.starts_at
      : existing.starts_at;
  const nextEndsAt =
    updates.ends_at !== undefined
      ? (updates.ends_at as string | null)
      : existing.ends_at;
  const endOrderError = validateEventEndAfterStart(nextStartsAt, nextEndsAt);
  if (endOrderError) {
    return NextResponse.json({ error: endOrderError }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("events")
    .update(updates)
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (updateError) {
    console.error("event update:", updateError);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }

  if (Array.isArray(body.studentIds)) {
    const studentIds = body.studentIds.filter(
      (sid: unknown): sid is string => typeof sid === "string"
    );
    const repertoireByStudent: Record<string, string> =
      body.repertoireByStudent &&
      typeof body.repertoireByStudent === "object" &&
      !Array.isArray(body.repertoireByStudent)
        ? body.repertoireByStudent
        : {};

    const replaced = await replaceEventStudents(
      supabase,
      user.id,
      id,
      studentIds,
      repertoireByStudent
    );
    if (!replaced.ok) {
      return NextResponse.json({ error: replaced.error }, { status: 500 });
    }

    const synced = await syncEventRsvps(supabase, id, replaced.guardianIds);
    if (!synced.ok) {
      return NextResponse.json({ error: synced.error }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("events")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("event delete:", error);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
