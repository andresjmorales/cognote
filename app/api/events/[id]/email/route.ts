import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  loadEventForEmail,
  sendEventEmails,
} from "@/lib/server/event-email";
import { getPolicy } from "@/lib/server/scheduling";
import { requestOrigin } from "@/lib/server/http";

export async function POST(
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

  const event = await loadEventForEmail(supabase, id, user.id);
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const policy = await getPolicy(supabase, user.id);
  const { sent, skipped } = await sendEventEmails({
    event,
    policy,
    teacherEmail: user.email,
    origin: requestOrigin(req),
    mode: "invite",
  });

  return NextResponse.json({ sent, skipped });
}
