import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** List recent notifications for the signed-in teacher. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, href, read_at, created_at")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const unreadCount = (data ?? []).filter((n) => !n.read_at).length;
  return NextResponse.json({ notifications: data ?? [], unreadCount });
}

/** Mark one or all notifications as read. Body: { id } | { all: true } */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const now = new Date().toISOString();

  if (body.all === true) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("teacher_id", user.id)
      .is("read_at", null);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (typeof body.id !== "string") {
    return NextResponse.json({ error: "id or all required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: now })
    .eq("id", body.id)
    .eq("teacher_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
