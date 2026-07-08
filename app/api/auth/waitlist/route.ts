import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** Public waitlist sign-up for people without a beta access code. */
export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const { error } = await serviceClient
    .from("waitlist")
    .upsert(
      { email: email.trim().toLowerCase() },
      { onConflict: "email", ignoreDuplicates: true }
    );

  if (error) {
    console.error("Waitlist insert failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
