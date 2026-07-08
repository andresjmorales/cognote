import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateShortToken } from "@/lib/token";

/**
 * Rotate a family's portal token. The old link stops working immediately —
 * this is the revocation mechanism portal tokens have that practice tokens
 * don't (ROADMAP §7).
 */
export async function POST(
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
    .from("guardians")
    .update({ portal_token: generateShortToken() })
    .eq("id", id)
    .eq("teacher_id", user.id)
    .select("id, portal_token")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
