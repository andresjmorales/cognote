import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
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
  const { data, error } = await supabase
    .from("plans")
    .insert({
      teacher_id: user.id,
      name: body.name,
      is_template: body.isTemplate ?? false,
      clef: body.clef ?? "treble",
      key_signature: body.keySignature ?? "C major",
      include_sharps: body.includeSharps ?? false,
      include_flats: body.includeFlats ?? false,
      include_chords: body.includeChords ?? false,
      measures_shown: body.measuresShown ?? 1,
      questions_per_lesson: body.questionsPerLesson ?? 10,
      answer_choices: body.answerChoices ?? 4,
      notes: body.notes ?? [],
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
