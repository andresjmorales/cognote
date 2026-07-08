import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { materializeLessons, getPolicy } from "@/lib/server/scheduling";
import {
  addDays,
  toLocalDateString,
  formatLessonTime,
  formatLessonDate,
  formatShortDate,
  ATTENDANCE_LABELS,
  oneToOne,
} from "@/lib/schedule";
import type { AttendanceStatus } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { BrandMark } from "@/components/brand/BrandMark";

export const metadata: Metadata = { title: "Family Portal" };

interface PortalLesson {
  id: string;
  student_id: string;
  lesson_date: string;
  starts_at: string;
  duration_minutes: number;
  makeup_for: string | null;
  attendance: { status: AttendanceStatus }[] | { status: AttendanceStatus } | null;
}

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: guardian } = await supabase
    .from("guardians")
    .select("id, name, teacher_id, students ( id, name )")
    .eq("portal_token", token)
    .single();

  if (!guardian) notFound();

  const students = (guardian.students ?? []) as { id: string; name: string }[];
  const studentIds = students.map((s) => s.id);

  const policy = await getPolicy(supabase, guardian.teacher_id);
  const today = toLocalDateString(new Date(), policy.timezone);

  let lessons: PortalLesson[] = [];
  let practiceLinks: {
    id: string;
    token: string;
    student_id: string;
    plans: { name: string } | null;
  }[] = [];
  let sharedNotes: {
    id: string;
    body: string;
    lessons: { lesson_date: string; student_id: string } | null;
  }[] = [];

  if (studentIds.length > 0) {
    await materializeLessons(supabase, guardian.teacher_id, today, addDays(today, 28));

    const [lessonsRes, linksRes, notesRes] = await Promise.all([
      supabase
        .from("lessons")
        .select(
          "id, student_id, lesson_date, starts_at, duration_minutes, makeup_for, attendance!lesson_id ( status )"
        )
        .in("student_id", studentIds)
        .gte("lesson_date", today)
        .lte("lesson_date", addDays(today, 28))
        .order("starts_at"),
      supabase
        .from("student_plans")
        .select("id, token, student_id, plans ( name )")
        .in("student_id", studentIds)
        .order("assigned_at", { ascending: false }),
      supabase
        .from("lesson_notes")
        .select("id, body, lessons!inner ( lesson_date, student_id )")
        .eq("shared_with_parent", true)
        .in("lessons.student_id", studentIds)
        .order("updated_at", { ascending: false })
        .limit(6),
    ]);
    lessons = (lessonsRes.data ?? []) as unknown as PortalLesson[];
    practiceLinks = (linksRes.data ?? []) as unknown as typeof practiceLinks;
    sharedNotes = (notesRes.data ?? []) as unknown as typeof sharedNotes;
  }

  const nameById = new Map(students.map((s) => [s.id, s.name]));
  const calendarPath = `/api/portal/${token}/calendar`;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-surface border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-2">
          <BrandMark size={28} className="h-7 w-7" />
          <span className="text-lg font-bold text-primary tracking-tight">
            {policy.studio_name || "CogNote"}
          </span>
          <span className="text-muted text-sm ml-2">Family Portal</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {guardian.name}</h1>
          <p className="text-muted text-sm mt-1">
            Practice links, lesson schedule, and notes for your family — no login needed.
            Keep this link private.
          </p>
        </div>

        {/* Practice links */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Practice</h2>
          {practiceLinks.length === 0 ? (
            <Card className="text-center text-muted">No practice assignments yet.</Card>
          ) : (
            <div className="space-y-2">
              {practiceLinks.map((link) => (
                <Card key={link.id} padding="sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{link.plans?.name ?? "Lesson"}</div>
                      <div className="text-xs text-muted">
                        {nameById.get(link.student_id) ?? "Student"}
                      </div>
                    </div>
                    <a
                      href={`/practice/${link.token}`}
                      className="inline-flex items-center justify-center font-semibold bg-primary text-white hover:bg-primary-dark px-4 py-2 text-sm rounded-lg transition-colors"
                    >
                      Practice
                    </a>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming lessons */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Upcoming Lessons</h2>
            <a
              href={calendarPath}
              download
              className="inline-flex items-center justify-center font-semibold bg-surface border border-border text-foreground hover:border-primary/50 px-3 py-1.5 text-xs rounded-lg transition-colors"
            >
              Download Calendar Events
            </a>
          </div>
          {lessons.length === 0 ? (
            <Card className="text-center text-muted">No lessons scheduled.</Card>
          ) : (
            <div className="space-y-2">
              {lessons.map((lesson) => {
                const status = oneToOne(lesson.attendance)?.status;
                const cancelled =
                  status === "teacher_cancel" || status === "student_cancel";
                return (
                  <Card key={lesson.id} padding="sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className={`font-medium ${cancelled ? "line-through text-muted" : ""}`}>
                          {formatLessonDate(lesson.starts_at, policy.timezone)} ·{" "}
                          {formatLessonTime(lesson.starts_at, policy.timezone)}
                        </div>
                        <div className="text-xs text-muted">
                          {nameById.get(lesson.student_id) ?? "Student"} ·{" "}
                          {lesson.duration_minutes} min
                          {lesson.makeup_for && " · make-up"}
                        </div>
                      </div>
                      {cancelled && status && (
                        <span className="text-xs text-error font-medium">
                          {ATTENDANCE_LABELS[status]}
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted mt-2">
            The download gives you an .ics file to import into Google Calendar,
            Apple Calendar, or Outlook. Most calendar apps can also subscribe to
            the same link so lessons stay up to date automatically.
          </p>
        </section>

        {/* Lesson notes from the teacher */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Notes from the Teacher</h2>
          {sharedNotes.length === 0 ? (
            <Card className="text-center text-muted">No notes shared yet.</Card>
          ) : (
            <div className="space-y-2">
              {sharedNotes.map((note) => (
                <Card key={note.id} padding="sm">
                  <div className="text-xs text-muted mb-1">
                    {note.lessons
                      ? `${nameById.get(note.lessons.student_id) ?? "Student"} · ${formatShortDate(
                          `${note.lessons.lesson_date}T12:00:00Z`,
                          "UTC"
                        )}`
                      : ""}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Studio info & policies */}
        {(policy.studio_info || policy.studio_website || policy.studio_contact) && (
          <section>
            <h2 className="text-lg font-semibold mb-3">
              About {policy.studio_name || "the Studio"}
            </h2>
            <Card padding="sm">
              {policy.studio_info && (
                <p className="text-sm whitespace-pre-wrap mb-3">
                  {policy.studio_info}
                </p>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm">
                {policy.studio_website && (
                  <a
                    href={policy.studio_website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary font-medium hover:underline"
                  >
                    Visit our website
                  </a>
                )}
                {policy.studio_contact && (
                  <span className="text-muted">{policy.studio_contact}</span>
                )}
              </div>
            </Card>
          </section>
        )}
      </main>
    </div>
  );
}
