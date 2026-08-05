import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { familyDisplayName } from "@/lib/guardians";
import { ageFromBirthdate } from "@/lib/students";
import { isActiveStudentPlan } from "@/lib/student-plans";
import { materializeLessons, getPolicy } from "@/lib/server/scheduling";
import {
  addDays,
  startOfWeek,
  toLocalDateString,
  formatLessonTime,
  formatLessonDate,
  oneToOne,
} from "@/lib/schedule";
import type { AttendanceStatus } from "@/lib/supabase/types";
import { DASHBOARD_STUDENT_PREVIEW_LIMIT } from "@/lib/ui-constants";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const policy = await getPolicy(supabase, user.id);
  const today = toLocalDateString(new Date(), policy.timezone);
  await materializeLessons(supabase, user.id, today, addDays(today, 28));

  const [
    { data: students },
    { data: recentSessions },
    { data: upcomingLessons },
    { data: recentLessons },
  ] =
    await Promise.all([
      supabase
        .from("students")
        .select(
          `
          id, name, birthdate, created_at,
          guardians ( name, family_name ),
          student_plans (
            id, unassigned_at,
            practice_sessions (
              id, started_at, completed_at, total_correct, total_questions
            )
          )
        `
        )
        .eq("teacher_id", user.id)
        .order("name"),
      supabase
        .from("practice_sessions")
        .select(
          `
          id, mode, started_at, completed_at, total_correct, total_questions,
          student_plans!inner (
            students!inner ( id, name, teacher_id ),
            plans!inner ( name )
          )
        `
        )
        .order("started_at", { ascending: false })
        .limit(10),
      supabase
        .from("lessons")
        .select(
          `
          id, lesson_date, starts_at, duration_minutes,
          students ( id, name ),
          attendance!lesson_id ( status )
        `
        )
        .eq("teacher_id", user.id)
        .gte("lesson_date", today)
        .lte("lesson_date", addDays(today, 28))
        .order("starts_at"),
      supabase
        .from("lessons")
        .select(
          `
          id, lesson_date, starts_at,
          students ( id, name ),
          attendance!lesson_id ( status ),
          lesson_notes ( id )
        `
        )
        .eq("teacher_id", user.id)
        .lte("lesson_date", today)
        .order("starts_at", { ascending: false })
        .limit(12),
    ]);

  const teacherSessions = (recentSessions ?? []).filter(
    (s: any) => s.student_plans?.students?.teacher_id === user.id
  );
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const sessionsThisWeek = teacherSessions.filter(
    (s: any) => new Date(s.started_at) > weekAgo
  );
  const weeklyQuestions = sessionsThisWeek.reduce(
    (sum: number, s: any) => sum + (s.total_questions ?? 0),
    0
  );
  const weeklyCorrect = sessionsThisWeek.reduce(
    (sum: number, s: any) => sum + (s.total_correct ?? 0),
    0
  );
  const weeklyAccuracy =
    weeklyQuestions > 0 ? Math.round((weeklyCorrect / weeklyQuestions) * 100) : null;
  const dashboardTitle =
    policy.studio_name?.trim() ||
    user.user_metadata?.display_name?.trim() ||
    "Dashboard";

  const activeAssignmentCount = (students ?? []).reduce(
    (count: number, student: any) =>
      count + (student.student_plans ?? []).filter(isActiveStudentPlan).length,
    0
  );
  const nextLessons = (upcomingLessons ?? []).filter((lesson: any) => {
    const status = oneToOne(
      lesson.attendance as { status: AttendanceStatus }[] | { status: AttendanceStatus } | null
    )?.status;
    return status !== "teacher_cancel" && status !== "student_cancel";
  });
  const nextLesson = nextLessons[0] ?? null;
  const nextByStudent = new Map<string, any>();
  for (const lesson of nextLessons) {
    const student = oneToOne(lesson.students as { id: string; name: string }[] | null);
    if (student && !nextByStudent.has(student.id)) {
      nextByStudent.set(student.id, lesson);
    }
  }
  const needsNoteLesson = (recentLessons ?? []).find((lesson: any) => {
    const status = oneToOne(
      lesson.attendance as { status: AttendanceStatus }[] | { status: AttendanceStatus } | null
    )?.status;
    const note = oneToOne(lesson.lesson_notes as { id: string }[] | { id: string } | null);
    return status && !note;
  });

  const allStudents = students ?? [];
  const studentPreview = [...allStudents]
    .sort((a: any, b: any) => {
      const aNext = nextByStudent.get(a.id)?.starts_at as string | undefined;
      const bNext = nextByStudent.get(b.id)?.starts_at as string | undefined;
      if (aNext && bNext) return aNext.localeCompare(bNext);
      if (aNext) return -1;
      if (bNext) return 1;
      return String(a.name).localeCompare(String(b.name));
    })
    .slice(0, DASHBOARD_STUDENT_PREVIEW_LIMIT);
  const studentsHidden = Math.max(0, allStudents.length - studentPreview.length);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {dashboardTitle === "Dashboard"
              ? "Dashboard"
              : `${dashboardTitle} Dashboard`}
          </h1>
          <p className="text-sm text-muted mt-1">
            Today&apos;s teaching snapshot, recent practice, and quick follow-ups.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/lessons/new">
            <Button size="sm">New Lesson</Button>
          </Link>
          <Link href="/students">
            <Button size="sm" variant="secondary">
              Add Student
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link href="/students">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer group bg-primary/5">
            <div className="text-sm text-muted">Students</div>
            <div className="text-3xl font-bold mt-1">{allStudents.length}</div>
          </Card>
        </Link>
        <Link href="/lessons">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer group bg-accent/5">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted">Active Assignments</div>
              <span className="text-muted text-xs group-hover:text-primary transition-colors">View all →</span>
            </div>
            <div className="text-3xl font-bold mt-1">{activeAssignmentCount}</div>
          </Card>
        </Link>
        <Card className="bg-success/5">
          <div className="text-sm text-muted">Practice This Week</div>
          <div className="flex items-end gap-3 mt-1">
            <div className="text-3xl font-bold">{sessionsThisWeek.length}</div>
            {weeklyAccuracy !== null && (
              <div className="text-sm text-success font-medium pb-1">
                {weeklyAccuracy}% avg
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <Card padding="sm" className="border-primary/20">
          <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            Next Lesson
          </div>
          {nextLesson ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">
                  {oneToOne(nextLesson.students as { name: string }[] | null)?.name ??
                    "Student"}
                </div>
                <div className="text-sm text-muted">
                  {formatLessonDate(nextLesson.starts_at, policy.timezone, "long")} at{" "}
                  {formatLessonTime(nextLesson.starts_at, policy.timezone)}
                </div>
              </div>
              <Link
                href={`/schedule?week=${startOfWeek(nextLesson.lesson_date)}`}
                className="text-sm text-primary font-medium hover:underline"
              >
                Open schedule
              </Link>
            </div>
          ) : (
            <div className="text-sm text-muted">No upcoming lessons scheduled.</div>
          )}
        </Card>
        <Card padding="sm" className="border-warning/30 bg-warning/5">
          <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            Follow-Up
          </div>
          {needsNoteLesson ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">
                  Add notes for{" "}
                  {oneToOne(needsNoteLesson.students as { name: string }[] | null)?.name ??
                    "student"}
                </div>
                <div className="text-sm text-muted">
                  Last marked lesson:{" "}
                  {formatLessonDate(needsNoteLesson.starts_at, policy.timezone)}
                </div>
              </div>
              <Link
                href={`/schedule?week=${startOfWeek(needsNoteLesson.lesson_date)}`}
                className="text-sm text-primary font-medium hover:underline"
              >
                Add note
              </Link>
            </div>
          ) : (
            <div className="text-sm text-muted">
              No marked lessons waiting on notes.
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold">Students</h2>
            {allStudents.length > 0 && (
              <Link
                href="/students"
                className="text-sm text-primary hover:underline shrink-0"
              >
                {studentsHidden > 0
                  ? `View all ${allStudents.length} →`
                  : "Manage students →"}
              </Link>
            )}
          </div>
          {!allStudents.length ? (
            <Card className="text-center text-muted">
              <p>No students yet.</p>
              <Link href="/students" className="text-primary text-sm hover:underline">
                Add your first student
              </Link>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {studentPreview.map((s: any) => {
                const family = s.guardians ? familyDisplayName(s.guardians) : null;
                const age = s.birthdate ? ageFromBirthdate(s.birthdate) : null;
                const activeAssignments = (s.student_plans ?? []).filter(isActiveStudentPlan);
                const sessions = (s.student_plans ?? []).flatMap(
                  (sp: any) => sp.practice_sessions ?? []
                );
                const latestSession = sessions.sort(
                  (a: any, b: any) =>
                    new Date(b.started_at).getTime() -
                    new Date(a.started_at).getTime()
                )[0];
                const next = nextByStudent.get(s.id);
                return (
                  <Link key={s.id} href={`/students/${s.id}`} className="block">
                    <Card
                      padding="sm"
                      className="hover:border-primary/40 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{s.name}</div>
                          <div className="text-xs text-muted mt-0.5">
                            {[family, age !== null ? `age ${age}` : null]
                              .filter(Boolean)
                              .join(" · ") || "No family linked"}
                          </div>
                          <div className="text-xs text-muted mt-1">
                            {activeAssignments.length} active lesson
                            {activeAssignments.length !== 1 && "s"}
                            {latestSession &&
                              ` · practiced ${new Date(latestSession.started_at).toLocaleDateString()}`}
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted shrink-0">
                          {next ? (
                            <>
                              <div className="font-medium text-foreground">Next</div>
                              <div>{formatLessonTime(next.starts_at, policy.timezone)}</div>
                              <div>{formatLessonDate(next.starts_at, policy.timezone)}</div>
                            </>
                          ) : (
                            "No slot"
                          )}
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
              {studentsHidden > 0 && (
                <Link href="/students" className="text-sm text-muted hover:text-primary hover:underline">
                  +{studentsHidden} more on the Students page
                </Link>
              )}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
          {!teacherSessions.length ? (
            <Card className="text-center text-muted">
              <p>No practice sessions yet.</p>
            </Card>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              {teacherSessions.slice(0, 5).map((s: any, i: number) => {
                const pct =
                  s.total_questions > 0
                    ? Math.round((s.total_correct / s.total_questions) * 100)
                    : 0;
                const studentId = s.student_plans?.students?.id;
                return (
                  <div
                    key={s.id}
                    className={`flex justify-between items-center px-3 py-2 text-sm${i > 0 ? " border-t border-border" : ""}`}
                  >
                    <div>
                      {studentId ? (
                        <Link href={`/students/${studentId}`} className="font-medium hover:text-primary transition-colors">
                          {s.student_plans?.students?.name}
                        </Link>
                      ) : (
                        <span className="font-medium">{s.student_plans?.students?.name}</span>
                      )}
                      <span className="text-muted ml-2">
                        {s.student_plans?.plans?.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          pct >= 80
                            ? "text-success font-medium"
                            : pct >= 50
                              ? "text-warning font-medium"
                              : "text-error font-medium"
                        }
                      >
                        {pct}%
                      </span>
                      <span className="text-muted">
                        {new Date(s.started_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
