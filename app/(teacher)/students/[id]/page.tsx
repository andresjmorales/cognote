import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { CopyLinkClient } from "@/components/teacher/CopyLinkClient";
import { AssignPlanToStudentButton } from "@/components/teacher/AssignPlanToStudentButton";
import { LaunchPlanToStudentButton } from "@/components/teacher/LaunchPlanToStudentButton";
import { RemoveStudentButton } from "@/components/teacher/RemoveStudentButton";
import { UnassignLessonButton } from "@/components/teacher/UnassignLessonButton";
import { StudentNotesEditor } from "@/components/teacher/StudentNotesEditor";
import { StudentInfoCard } from "@/components/teacher/StudentInfoCard";
import { SkillsPanel } from "@/components/teacher/skills/SkillsPanel";
import { getOrSeedDimensions } from "@/lib/server/skills";
import { familyDisplayName } from "@/lib/guardians";
import { isActiveStudentPlan } from "@/lib/student-plans";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("name")
    .eq("id", id)
    .single();
  return { title: student?.name ?? "Student" };
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [
    { data: student },
    { data: studentPlans },
    { data: allPlans },
    dimensions,
    { data: assessments },
    { data: attendedLessons },
  ] = await Promise.all([
    supabase
      .from("students")
      .select("*, guardians ( id, name, family_name, email )")
      .eq("id", id)
      .eq("teacher_id", user.id)
      .single(),
    supabase
      .from("student_plans")
      .select(
        `
          id, token, assigned_at, due_date, unassigned_at,
          plans ( id, name, clef, key_signature, notes, plan_type ),
          practice_sessions (
            id, mode, started_at, completed_at,
            total_correct, total_incorrect, total_questions
          )
        `
      )
      .eq("student_id", id)
      .order("assigned_at", { ascending: false }),
    supabase
      .from("plans")
      .select("id, name")
      .eq("teacher_id", user.id)
      .order("name"),
    getOrSeedDimensions(supabase, user.id),
    supabase
      .from("skill_assessments")
      .select("id, dimension_id, rating, assessed_on, created_at")
      .eq("student_id", id)
      .order("assessed_on")
      .order("created_at"),
    supabase
      .from("lessons")
      // attendance!lesson_id disambiguates from the lessons.makeup_for FK
      .select("id, lesson_date, attendance!lesson_id ( status )")
      .eq("student_id", id)
      .order("lesson_date", { ascending: false }),
  ]);

  if (!student) notFound();

  const activePlans = (studentPlans ?? []).filter(isActiveStudentPlan);
  const pastPlans = (studentPlans ?? []).filter((sp) => !isActiveStudentPlan(sp));

  // Attendance summary — only lessons that have been marked count.
  const attendanceCounts: Record<string, number> = {};
  (attendedLessons ?? []).forEach((l: any) => {
    const status = (Array.isArray(l.attendance) ? l.attendance[0] : l.attendance)
      ?.status;
    if (status) attendanceCounts[status] = (attendanceCounts[status] ?? 0) + 1;
  });
  const markedLessons = Object.values(attendanceCounts).reduce((a, b) => a + b, 0);
  const attendanceRate =
    markedLessons > 0
      ? Math.round(((attendanceCounts.attended ?? 0) / markedLessons) * 100)
      : null;

  const allSessions = (studentPlans ?? []).flatMap((sp: any) =>
    (sp.practice_sessions ?? []).map((session: any) => ({
      ...session,
      plan: sp.plans,
    }))
  );
  const totalSessions = allSessions.length;
  const completedSessions = allSessions.filter(
    (s: any) => s.completed_at
  ).length;
  const totalCorrect = allSessions.reduce(
    (sum: number, s: any) => sum + (s.total_correct ?? 0),
    0
  );
  const totalQuestions = allSessions.reduce(
    (sum: number, s: any) => sum + (s.total_questions ?? 0),
    0
  );
  const overallAccuracy =
    totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : null;

  const sessionIds = allSessions.map((s: any) => s.id);
  const { data: attempts } = sessionIds.length > 0
    ? await supabase
        .from("note_attempts")
        .select("note_displayed, is_correct")
        .in("session_id", sessionIds)
    : { data: [] };

  const noteStats: Record<string, { correct: number; total: number }> = {};
  (attempts ?? []).forEach((a: any) => {
    if (!noteStats[a.note_displayed]) {
      noteStats[a.note_displayed] = { correct: 0, total: 0 };
    }
    noteStats[a.note_displayed].total++;
    if (a.is_correct) noteStats[a.note_displayed].correct++;
  });

  const allItems = Object.entries(noteStats)
    .map(([note, stats]) => ({
      note,
      accuracy: Math.round((stats.correct / stats.total) * 100),
      total: stats.total,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  const isMusicalNote = (s: string) => /^[A-G][b#]?\d$/.test(s);
  const noteItems = allItems.filter((i) => isMusicalNote(i.note));
  const conceptItems = allItems.filter((i) => !isMusicalNote(i.note));

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/students" className="text-muted hover:text-foreground">
          ← Students
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">{student.name}</h1>
          {(student.guardians as { id: string; name: string } | null)?.name ? (
            <p className="text-muted text-sm">
              Family:{" "}
              <Link
                href={`/families/${(student.guardians as { id: string }).id}`}
                className="hover:text-primary transition-colors"
              >
                {familyDisplayName(
                  student.guardians as { name: string; family_name: string | null }
                )}
              </Link>
            </p>
          ) : student.parent_contact ? (
            <p className="text-muted text-sm">{student.parent_contact}</p>
          ) : (
            <p className="text-muted text-sm">
              <Link href="/families" className="hover:text-primary transition-colors">
                No family linked — set one up
              </Link>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <LaunchPlanToStudentButton
            studentId={id}
            studentName={student.name}
            plans={allPlans ?? []}
          />
          <AssignPlanToStudentButton
            studentId={id}
            studentName={student.name}
            plans={allPlans ?? []}
          />
          <RemoveStudentButton studentId={id} studentName={student.name} />
        </div>
      </div>

      {/* Level + birthday */}
      <StudentInfoCard
        studentId={id}
        initialLevel={student.level ?? null}
        initialBirthdate={student.birthdate ?? null}
      />

      {/* Teacher Notes */}
      <StudentNotesEditor
        studentId={id}
        initialNotes={student.teacher_notes ?? ""}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card padding="sm">
          <div className="text-xs text-muted">Sessions</div>
          <div className="text-2xl font-bold">{totalSessions}</div>
        </Card>
        <Card padding="sm">
          <div className="text-xs text-muted">Completed</div>
          <div className="text-2xl font-bold">{completedSessions}</div>
        </Card>
        <Card padding="sm">
          <div className="text-xs text-muted">Accuracy</div>
          <div className="text-2xl font-bold">
            {overallAccuracy !== null ? `${overallAccuracy}%` : "—"}
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-xs text-muted">Questions</div>
          <div className="text-2xl font-bold">{totalQuestions}</div>
        </Card>
      </div>

      {/* Progress: skills + attendance */}
      <h2 className="text-lg font-semibold mb-3">Progress</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <SkillsPanel
          studentId={id}
          dimensions={dimensions}
          assessments={assessments ?? []}
        />
        <Card padding="sm">
          <h3 className="font-semibold mb-3">Attendance</h3>
          {markedLessons === 0 ? (
            <p className="text-sm text-muted text-center py-6">
              No attendance marked yet. Mark lessons on the{" "}
              <Link href="/schedule" className="text-primary hover:underline">
                Schedule
              </Link>{" "}
              page.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="rounded-lg bg-surface-dim/60 p-3">
                  <div className="text-xs text-muted">Attended</div>
                  <div className="text-xl font-bold text-success">
                    {attendanceCounts.attended ?? 0}
                    <span className="text-sm font-normal text-muted">
                      {" "}
                      / {markedLessons}
                    </span>
                  </div>
                </div>
                <div className="rounded-lg bg-surface-dim/60 p-3">
                  <div className="text-xs text-muted">Attendance Rate</div>
                  <div className="text-xl font-bold">
                    {attendanceRate !== null ? `${attendanceRate}%` : "—"}
                  </div>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                {[
                  ["student_cancel", "Student cancellations"],
                  ["teacher_cancel", "Teacher cancellations"],
                  ["no_show", "No-shows"],
                ].map(([key, label]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted">{label}</span>
                    <span className="font-medium">{attendanceCounts[key] ?? 0}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assigned Plans */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Assigned Lessons</h2>
          {!activePlans.length ? (
            <Card className="text-center text-muted">
              <p>No lessons assigned yet.</p>
              <p className="text-sm mt-1">Use the &quot;Assign Lesson&quot; button above.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {(activePlans as any[]).map((sp) => {
                const sessions = sp.practice_sessions?.length ?? 0;
                const practiceUrl = `/practice/${sp.token}`;
                const isSymbolPlan = sp.plans?.plan_type === "symbol_concepts";
                return (
                  <Card key={sp.id} padding="sm">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        {sp.plans?.id ? (
                          <Link href={`/lessons/${sp.plans.id}`} className="font-medium hover:text-primary transition-colors">
                            {sp.plans.name}
                          </Link>
                        ) : (
                          <span className="font-medium">{sp.plans?.name ?? "Unknown Lesson"}</span>
                        )}
                        <div className="text-xs text-muted">
                          {isSymbolPlan ? "Symbols & Concepts" : (
                            <>{sp.plans?.clef} clef{sp.plans?.plan_type !== "note_identification" && sp.plans?.key_signature ? ` · ${sp.plans.key_signature}` : ""} · {(sp.plans?.notes as string[])?.length ?? 0} notes</>
                          )}
                        </div>
                        <div className="text-xs text-muted mt-1">
                          {sessions} session{sessions !== 1 && "s"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={practiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center font-semibold transition-all duration-150 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none bg-surface text-foreground border border-border hover:bg-surface-dim focus:ring-primary/20 px-3 py-1.5 text-sm rounded-lg"
                        >
                          Launch
                        </a>
                        <CopyLinkClient url={practiceUrl} />
                        <UnassignLessonButton
                          studentPlanId={sp.id}
                          lessonName={sp.plans?.name ?? "Lesson"}
                          sessionCount={sessions}
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {pastPlans.length > 0 && (
            <>
              <h2 className="text-lg font-semibold mb-3 mt-6">Past Lessons</h2>
              <div className="space-y-2">
                {(pastPlans as any[]).map((sp) => {
                  const sessions = sp.practice_sessions?.length ?? 0;
                  const isSymbolPlan = sp.plans?.plan_type === "symbol_concepts";
                  return (
                    <Card key={sp.id} padding="sm" className="opacity-80">
                      <div>
                        {sp.plans?.id ? (
                          <Link href={`/lessons/${sp.plans.id}`} className="font-medium hover:text-primary transition-colors">
                            {sp.plans.name}
                          </Link>
                        ) : (
                          <span className="font-medium">{sp.plans?.name ?? "Unknown Lesson"}</span>
                        )}
                        <div className="text-xs text-muted">
                          {isSymbolPlan ? "Symbols & Concepts" : (
                            <>{sp.plans?.clef} clef · {(sp.plans?.notes as string[])?.length ?? 0} notes</>
                          )}
                        </div>
                        <div className="text-xs text-muted mt-1">
                          {sessions} session{sessions !== 1 && "s"}
                          {sp.unassigned_at &&
                            ` · unassigned ${new Date(sp.unassigned_at).toLocaleDateString()}`}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Accuracy Breakdown */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Accuracy</h2>
          {allItems.length === 0 ? (
            <Card className="text-center text-muted">
              <p>No practice data yet.</p>
            </Card>
          ) : (
            <Card padding="sm">
              <div className="space-y-2">
                {noteItems.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-muted uppercase tracking-wide">Notes</p>
                    {noteItems.map(({ note, accuracy, total }) => (
                      <div key={note} className="flex items-center gap-2">
                        <span className="w-20 shrink-0 font-semibold text-xs truncate" title={note}>
                          {note}
                        </span>
                        <div className="flex-1 h-5 bg-surface-dim rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              accuracy >= 80
                                ? "bg-success"
                                : accuracy >= 50
                                  ? "bg-warning"
                                  : "bg-error"
                            }`}
                            style={{ width: `${accuracy}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted w-16 text-right shrink-0">
                          {accuracy}% ({total})
                        </span>
                      </div>
                    ))}
                  </>
                )}
                {noteItems.length > 0 && conceptItems.length > 0 && (
                  <hr className="border-border my-2" />
                )}
                {conceptItems.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-muted uppercase tracking-wide">Concepts</p>
                    {conceptItems.map(({ note, accuracy, total }) => (
                      <div key={note} className="flex items-center gap-2">
                        <span className="w-20 shrink-0 font-semibold text-xs truncate" title={note}>
                          {note}
                        </span>
                        <div className="flex-1 h-5 bg-surface-dim rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              accuracy >= 80
                                ? "bg-success"
                                : accuracy >= 50
                                  ? "bg-warning"
                                  : "bg-error"
                            }`}
                            style={{ width: `${accuracy}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted w-16 text-right shrink-0">
                          {accuracy}% ({total})
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </Card>
          )}

          {/* Recent Sessions */}
          <h2 className="text-lg font-semibold mb-3 mt-6">Recent Sessions</h2>
          {allSessions.length === 0 ? (
            <Card className="text-center text-muted">
              <p>No sessions yet.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {allSessions
                .sort(
                  (a: any, b: any) =>
                    new Date(b.started_at).getTime() -
                    new Date(a.started_at).getTime()
                )
                .slice(0, 10)
                .map((s: any) => {
                  const pct =
                    s.total_questions > 0
                      ? Math.round((s.total_correct / s.total_questions) * 100)
                      : 0;
                  return (
                    <Card key={s.id} padding="sm">
                      <div className="flex justify-between text-sm">
                        <div>
                          <span className="capitalize">{s.mode.replace("_", " ")}</span>
                          {s.plan?.name && (
                            <span className="text-muted ml-2">· {s.plan.name}</span>
                          )}
                          <span className="text-muted ml-2">
                            {s.total_correct}/{s.total_questions}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
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
                          <span className="text-muted text-xs">
                            {new Date(s.started_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
