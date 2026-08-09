import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  rejectIfTokenLookupsBlocked,
  recordTokenLookupFailure,
} from "@/lib/server/token-guard";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id: sessionId } = await params;

  const blocked = rejectIfTokenLookupsBlocked(req);
  if (blocked) return blocked;

  const supabase = createServiceClient();

  // The session must belong to the student plan this token resolves to;
  // session UUIDs alone are not authorization.
  const { data: session } = await supabase
    .from("practice_sessions")
    .select("id, student_plans!inner ( token, unassigned_at )")
    .eq("id", sessionId)
    .single();

  const studentPlan = session?.student_plans as unknown as
    | { token: string; unassigned_at: string | null }
    | undefined;

  if (!session || !studentPlan || studentPlan.token !== token || studentPlan.unassigned_at) {
    recordTokenLookupFailure(req);
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

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
