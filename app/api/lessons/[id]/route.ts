import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseBody, planUpdateSchema } from "@/lib/server/api-schemas";

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

  const parsed = parseBody(planUpdateSchema, await req.json().catch(() => null));
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const { data, error } = await supabase
    .from("plans")
    .update({
      name: body.name,
      is_template: body.isTemplate,
      clef: body.clef,
      key_signature: body.keySignature,
      include_sharps: body.includeSharps,
      include_flats: body.includeFlats,
      measures_shown: body.measuresShown,
      questions_per_lesson: body.questionsPerLesson,
      answer_choices: body.answerChoices,
      notes: body.notes,
    })
    .eq("id", id)
    .eq("teacher_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
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

  const { error } = await supabase
    .from("plans")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
