import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateShortToken } from "@/lib/token";

/**
 * Rotate the teacher's calendar-feed token. The old feed URL stops working
 * immediately — this is the revocation mechanism the feed token has.
 */
export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("teachers")
    .update({ calendar_token: generateShortToken() })
    .eq("id", user.id)
    .select("id, calendar_token")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
