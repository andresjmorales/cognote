import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { displayName } = await req.json();

  if (!displayName || typeof displayName !== "string" || !displayName.trim()) {
    return NextResponse.json({ error: "Display name is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("teachers")
    .update({ display_name: displayName.trim() })
    .eq("id", user.id);

  if (error) {
    console.error("Failed to update profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
