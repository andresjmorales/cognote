import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import { toLocalDateString } from "@/lib/schedule";

/**
 * Record a round of skill ratings for a student. Assessments are appended,
 * never updated — the timestamped history is what draws the trend lines.
 *
 * Body: { ratings: [{ dimensionId, rating (1–5), note? }] }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: studentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify student belongs to teacher
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("id", studentId)
    .eq("teacher_id", user.id)
    .single();

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const body = await req.json();
  const ratings: unknown = body.ratings;
  if (!Array.isArray(ratings) || ratings.length === 0) {
    return NextResponse.json({ error: "ratings required" }, { status: 400 });
  }

  for (const r of ratings) {
    if (
      typeof r?.dimensionId !== "string" ||
      typeof r?.rating !== "number" ||
      !Number.isInteger(r.rating) ||
      r.rating < 1 ||
      r.rating > 5
    ) {
      return NextResponse.json(
        { error: "Each rating needs a dimensionId and an integer rating 1–5" },
        { status: 400 }
      );
    }
  }

  // Studio-local date, not the server's UTC date (already "tomorrow" during
  // US evenings).
  const policy = await getPolicy(supabase, user.id);
  const assessedOn = toLocalDateString(new Date(), policy.timezone);

  const { data, error } = await supabase
    .from("skill_assessments")
    .insert(
      ratings.map((r: { dimensionId: string; rating: number; note?: string }) => ({
        student_id: studentId,
        dimension_id: r.dimensionId,
        rating: r.rating,
        note: typeof r.note === "string" && r.note.trim() ? r.note.trim() : null,
        assessed_on: assessedOn,
      }))
    )
    .select("id, dimension_id, rating, note, assessed_on, created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
