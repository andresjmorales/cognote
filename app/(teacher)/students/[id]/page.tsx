import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { CopyLinkClient } from "@/components/teacher/CopyLinkClient";
import { AssignPlanToStudentButton } from "@/components/teacher/AssignPlanToStudentButton";
import { StudentNotesEditor } from "@/components/teacher/StudentNotesEditor";

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

  const [{ data: student }, { data: studentPlans }, { data: allPlans }] =
    await Promise.all([
      supabase
        .from("students")
        .select("*")
        .eq("id", id)
        .eq("teacher_id", user.id)
        .single(),
      supabase
        .from("student_plans")
        .select(
          `
          id, token, assigned_at, due_date,
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
    ]);

  if (!student) notFound();

  const allSessions = (studentPlans ?? []).flatMap(
    (sp: any) => sp.practice_sessions ?? []
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

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{student.name}</h1>
          {student.parent_contact && (
            <p className="text-muted text-sm">{student.parent_contact}</p>
          )}
        </div>
        <AssignPlanToStudentButton
          studentId={id}
          studentName={student.name}
          plans={allPlans ?? []}
        />
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assigned Plans */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Assigned Lessons</h2>
          {!studentPlans?.length ? (
            <Card className="text-center text-muted">
              <p>No lessons assigned yet.</p>
              <p className="text-sm mt-1">Use the &quot;Assign Lesson&quot; button above.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {(studentPlans as any[]).map((sp) => {
                const sessions = sp.practice_sessions?.length ?? 0;
                const practiceUrl = `/practice/${sp.token}`;
                const isSymbolPlan = sp.plans?.plan_type === "symbol_concepts";
                return (
                  <Card key={sp.id} padding="sm">
                    <div className="flex justify-between items-start">
                      <div>
                        {sp.plans?.id ? (
                          <Link href={`/plans/${sp.plans.id}`} className="font-medium hover:text-primary transition-colors">
                            {sp.plans.name}
                          </Link>
                        ) : (
                          <span className="font-medium">{sp.plans?.name ?? "Unknown Lesson"}</span>
                        )}
                        <div className="text-xs text-muted">
                          {isSymbolPlan ? "Symbols & Concepts" : (
                            <>{sp.plans?.clef} clef · {sp.plans?.key_signature} · {(sp.plans?.notes as string[])?.length ?? 0} notes</>
                          )}
                        </div>
                        <div className="text-xs text-muted mt-1">
                          {sessions} session{sessions !== 1 && "s"}
                        </div>
                      </div>
                      <CopyLinkClient url={practiceUrl} />
                    </div>
                  </Card>
                );
              })}
            </div>
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
