import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { id: sessionId } = await params;
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("practice_sessions")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) {
    console.error("Failed to complete session:", error);
    return NextResponse.json({ error: "Failed to complete session" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
