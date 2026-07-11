import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BULK_ATTENDANCE_STATUSES } from "@/lib/schedule";
import { getPolicy } from "@/lib/server/scheduling";
import { requestOrigin } from "@/lib/server/http";
import { emailFamiliesTeacherCancelBulk } from "@/lib/server/lesson-cancel-email";
import type { AttendanceStatus } from "@/lib/supabase/types";

const MAX_IDS = 50;

/**
 * Bulk-mark attendance for simple statuses only (attended / no_show /
 * teacher_cancel). Student cancel stays on the per-lesson dialog.
 * Teacher cancel emails families when notifyFamily is true (default).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const status = body.status as AttendanceStatus | undefined;
  const ids = Array.isArray(body.ids)
    ? (body.ids as unknown[]).filter((id): id is string => typeof id === "string")
    : [];
  const notifyFamily = body.notifyFamily !== false;

  if (!status || !BULK_ATTENDANCE_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "status must be attended, no_show, or teacher_cancel" },
      { status: 400 }
    );
  }
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json(
      { error: `At most ${MAX_IDS} lessons at once` },
      { status: 400 }
    );
  }

  const { data: owned } = await supabase
    .from("lessons")
    .select("id")
    .eq("teacher_id", user.id)
    .in("id", ids);

  const ownedIds = new Set((owned ?? []).map((l) => l.id));
  const now = new Date().toISOString();
  let succeeded = 0;
  let emailed = 0;
  const failed: { id: string; error: string }[] = [];
  const successfullyCancelledIds: string[] = [];
  const policy =
    status === "teacher_cancel" && notifyFamily
      ? await getPolicy(supabase, user.id)
      : null;
  const origin = requestOrigin(req);

  for (const id of ids) {
    if (!ownedIds.has(id)) {
      failed.push({ id, error: "Not found" });
      continue;
    }
    const { error } = await supabase.from("attendance").upsert(
      {
        lesson_id: id,
        status,
        notice_at: null,
        marked_at: now,
      },
      { onConflict: "lesson_id" }
    );
    if (error) {
      failed.push({ id, error: error.message });
      continue;
    }
    succeeded += 1;
    if (status === "teacher_cancel") successfullyCancelledIds.push(id);
  }

  if (
    status === "teacher_cancel" &&
    notifyFamily &&
    policy &&
    successfullyCancelledIds.length > 0
  ) {
    const result = await emailFamiliesTeacherCancelBulk({
      supabase,
      lessonIds: successfullyCancelledIds,
      teacherId: user.id,
      teacherEmail: user.email,
      policy,
      origin,
    });
    emailed = result.emailed;
  }

  return NextResponse.json({
    ok: failed.length === 0,
    succeeded,
    emailed,
    failed,
  });
}
