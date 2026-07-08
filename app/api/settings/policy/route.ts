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

  let durationOptions: number[] | undefined;
  if (body.lessonDurationOptions !== undefined) {
    if (!Array.isArray(body.lessonDurationOptions)) {
      return NextResponse.json(
        { error: "lessonDurationOptions must be an array" },
        { status: 400 }
      );
    }
    const cleaned = (body.lessonDurationOptions as unknown[])
      .map((v) => Number(v))
      .filter((v) => Number.isInteger(v) && v >= 5 && v <= 240);
    durationOptions = [...new Set(cleaned)].sort((a, b) => a - b);
    if (durationOptions.length === 0) {
      return NextResponse.json(
        { error: "At least one time block between 5 and 240 minutes is required" },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("studio_policies")
    .upsert(
      {
        teacher_id: user.id,
        ...(body.studioName !== undefined && {
          studio_name: String(body.studioName).trim().slice(0, 120),
        }),
        ...(durationOptions !== undefined && {
          lesson_duration_options: durationOptions,
        }),
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
