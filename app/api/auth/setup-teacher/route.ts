import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { displayName } = await req.json();
  const serviceClient = createServiceClient();

  // Check if a teacher row already exists for this auth user
  const { data: existing } = await serviceClient
    .from("teachers")
    .select("id")
    .eq("id", user.id)
    .single();

  if (existing) {
    return NextResponse.json({ ok: true });
  }

  // Create a new teacher row tied to the authenticated user's ID
  const { error } = await serviceClient.from("teachers").insert({
    id: user.id,
    email: user.email!,
    display_name: displayName || user.email?.split("@")[0] || "Teacher",
  });

  if (error) {
    console.error("Failed to create teacher row:", error);
    return NextResponse.json({ error: "Failed to set up account" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
