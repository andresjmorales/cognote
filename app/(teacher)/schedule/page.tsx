import { createClient } from "@/lib/supabase/server";
import { materializeLessons, getPolicy } from "@/lib/server/scheduling";
import {
  addDays,
  startOfWeek,
  toLocalDateString,
  earnsMakeupCredit,
  creditIsValid,
  oneToOne,
} from "@/lib/schedule";
import type { AttendanceStatus } from "@/lib/supabase/types";
import { WeekView, type WeekLesson } from "@/components/teacher/schedule/WeekView";
import { SlotManager } from "@/components/teacher/schedule/SlotManager";
import { MakeupPanel, type MakeupCredit } from "@/components/teacher/schedule/MakeupPanel";
import Link from "next/link";

export const metadata = { title: "Schedule" };

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const policy = await getPolicy(supabase, user.id);
  const today = toLocalDateString(new Date(), policy.timezone);
  const weekStart = startOfWeek(
    week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today
  );
  const weekEnd = addDays(weekStart, 6);

  // Materialize the visible week plus the standard forward horizon
  const matFrom = weekStart < today ? weekStart : today;
  const matTo = weekEnd > addDays(today, 56) ? weekEnd : addDays(today, 56);
  await materializeLessons(supabase, user.id, matFrom, matTo);

  const [lessonsRes, slotsRes, studentsRes, attendanceRes, redeemedRes] =
    await Promise.all([
      supabase
        .from("lessons")
        .select(
          `id, student_id, slot_id, lesson_date, starts_at, duration_minutes, makeup_for,
           students ( name ),
           attendance!lesson_id ( id, status, notice_at ),
           lesson_notes ( body, shared_with_parent, emailed_at )`
        )
        .eq("teacher_id", user.id)
        .gte("lesson_date", weekStart)
        .lte("lesson_date", weekEnd)
        .order("starts_at"),
      supabase
        .from("lesson_slots")
        .select("*, students ( name )")
        .eq("teacher_id", user.id)
        .order("day_of_week")
        .order("start_time"),
      supabase
        .from("students")
        .select("id, name")
        .eq("teacher_id", user.id)
        .order("name"),
      // All non-attended attendance rows — make-up credit candidates
      supabase
        .from("attendance")
        .select(
          "id, status, notice_at, marked_at, lessons!lesson_id ( id, student_id, starts_at, duration_minutes, teacher_id, students ( name ) )"
        )
        .neq("status", "attended"),
      // Which credits are already redeemed by a make-up lesson
      supabase
        .from("lessons")
        .select("makeup_for")
        .eq("teacher_id", user.id)
        .not("makeup_for", "is", null),
    ]);

  const weekLessons: WeekLesson[] = (lessonsRes.data ?? []).map((l) => {
    const att = oneToOne(l.attendance as { id: string; status: AttendanceStatus; notice_at: string | null }[] | null);
    const note = oneToOne(
      l.lesson_notes as { body: string; shared_with_parent: boolean; emailed_at: string | null }[] | null
    );
    return {
      id: l.id,
      studentId: l.student_id,
      studentName: (oneToOne(l.students as { name: string }[] | null))?.name ?? "Student",
      isAdHoc: !l.slot_id,
      isMakeup: !!l.makeup_for,
      lessonDate: l.lesson_date,
      startsAt: l.starts_at,
      durationMinutes: l.duration_minutes,
      attendance: att ? { status: att.status, noticeAt: att.notice_at } : null,
      note: note
        ? {
            body: note.body,
            sharedWithParent: note.shared_with_parent,
            emailedAt: note.emailed_at,
          }
        : null,
    };
  });

  const redeemed = new Set(
    (redeemedRes.data ?? []).map((l) => l.makeup_for as string)
  );
  const credits: MakeupCredit[] = (attendanceRes.data ?? [])
    .map((a) => ({
      ...a,
      lesson: oneToOne(
        a.lessons as unknown as
          | {
              id: string;
              student_id: string;
              starts_at: string;
              duration_minutes: number;
              teacher_id: string;
              students: { name: string } | { name: string }[] | null;
            }[]
          | null
      ),
    }))
    .filter(
      (a) =>
        a.lesson &&
        a.lesson.teacher_id === user.id &&
        !redeemed.has(a.id) &&
        earnsMakeupCredit(
          a.status as AttendanceStatus,
          a.notice_at,
          a.lesson.starts_at,
          policy
        ) &&
        creditIsValid(a.marked_at, policy)
    )
    .map((a) => ({
      attendanceId: a.id,
      status: a.status as AttendanceStatus,
      studentId: a.lesson!.student_id,
      studentName: oneToOne(a.lesson!.students as { name: string }[] | null)?.name ?? "Student",
      missedAt: a.lesson!.starts_at,
      durationMinutes: a.lesson!.duration_minutes,
    }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Schedule</h1>
        <p className="text-muted text-sm mt-1">
          Weekly lessons materialized from recurring slots — tap a lesson to mark
          attendance and jot notes for the family.
        </p>
      </div>

      <WeekView
        weekStart={weekStart}
        today={today}
        timezone={policy.timezone}
        lessons={weekLessons}
        students={studentsRes.data ?? []}
        durationOptions={policy.lesson_duration_options}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="space-y-6">
          <SlotManager
            slots={(slotsRes.data ?? []).map((s) => ({
              ...s,
              studentName: oneToOne(s.students as { name: string }[] | null)?.name ?? "Student",
            }))}
            students={studentsRes.data ?? []}
            durationOptions={policy.lesson_duration_options}
          />
        </div>
        <div className="space-y-6">
          <MakeupPanel credits={credits} timezone={policy.timezone} />
          <p className="text-sm text-muted">
            Cancellation window, make-up rules, and time blocks live in{" "}
            <Link href="/settings" className="text-primary hover:underline">
              Studio Settings
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
