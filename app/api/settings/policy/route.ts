import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getPolicy(supabase, user.id));
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (body.timezone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: body.timezone });
    } catch {
      return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("studio_policies")
    .upsert(
      {
        teacher_id: user.id,
        ...(body.timezone !== undefined && { timezone: body.timezone }),
        ...(body.cancellationWindowHours !== undefined && {
          cancellation_window_hours: Number(body.cancellationWindowHours),
        }),
        ...(body.timelyCancelEarnsMakeup !== undefined && {
          timely_cancel_earns_makeup: Boolean(body.timelyCancelEarnsMakeup),
        }),
        ...(body.lateCancelEarnsMakeup !== undefined && {
          late_cancel_earns_makeup: Boolean(body.lateCancelEarnsMakeup),
        }),
        ...(body.noShowEarnsMakeup !== undefined && {
          no_show_earns_makeup: Boolean(body.noShowEarnsMakeup),
        }),
        ...(body.teacherCancelEarnsMakeup !== undefined && {
          teacher_cancel_earns_makeup: Boolean(body.teacherCancelEarnsMakeup),
        }),
        ...(body.makeupCreditExpiryDays !== undefined && {
          makeup_credit_expiry_days: body.makeupCreditExpiryDays
            ? Number(body.makeupCreditExpiryDays)
            : null,
        }),
      },
      { onConflict: "teacher_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
