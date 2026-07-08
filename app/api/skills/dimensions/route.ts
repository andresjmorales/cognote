import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrSeedDimensions } from "@/lib/server/skills";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dimensions = await getOrSeedDimensions(supabase, user.id);
    return NextResponse.json(dimensions);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load skills";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // New dimensions go to the end of the list.
  const { data: last } = await supabase
    .from("skill_dimensions")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("skill_dimensions")
    .insert({
      teacher_id: user.id,
      name,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select("id, name, sort_order")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `A skill named "${name}" already exists` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
