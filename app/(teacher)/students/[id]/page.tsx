import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .single();

  if (!student) notFound();

  const { data: studentPlans } = await supabase
    .from("student_plans")
    .select(
      `
      id, token, assigned_at, due_date,
      plans ( id, name, clef, key_signature, notes ),
      practice_sessions (
        id, mode, started_at, completed_at,
        total_correct, total_incorrect, total_questions
      )
    `
    )
    .eq("student_id", id)
    .order("assigned_at", { ascending: false });

  // Gather all sessions across plans
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

  // Note-level accuracy from attempts
  const { data: attempts } = await supabase
    .from("note_attempts")
    .select("note_displayed, is_correct")
    .in(
      "session_id",
      allSessions.map((s: any) => s.id)
    );

  const noteStats: Record<string, { correct: number; total: number }> = {};
  (attempts ?? []).forEach((a: any) => {
    if (!noteStats[a.note_displayed]) {
      noteStats[a.note_displayed] = { correct: 0, total: 0 };
    }
    noteStats[a.note_displayed].total++;
    if (a.is_correct) noteStats[a.note_displayed].correct++;
  });

  const sortedNotes = Object.entries(noteStats)
    .map(([note, stats]) => ({
      note,
      accuracy: Math.round((stats.correct / stats.total) * 100),
      total: stats.total,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/students" className="text-muted hover:text-foreground">
          ← Students
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{student.name}</h1>
          {student.parent_contact && (
            <p className="text-muted text-sm">{student.parent_contact}</p>
          )}
        </div>
      </div>

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
          <h2 className="text-lg font-semibold mb-3">Assigned Plans</h2>
          {!studentPlans?.length ? (
            <Card className="text-center text-muted">
              <p>No plans assigned yet.</p>
              <Link href="/plans" className="text-primary text-sm hover:underline">
                Assign a plan
              </Link>
            </Card>
          ) : (
            <div className="space-y-2">
              {(studentPlans as any[]).map((sp) => {
                const sessions = sp.practice_sessions?.length ?? 0;
                const practiceUrl = `/practice/${sp.token}`;
                return (
                  <Card key={sp.id} padding="sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{sp.plans?.name}</div>
                        <div className="text-xs text-muted">
                          {sp.plans?.clef} clef · {sp.plans?.key_signature} ·{" "}
                          {(sp.plans?.notes as string[])?.length ?? 0} notes
                        </div>
                        <div className="text-xs text-muted mt-1">
                          {sessions} session{sessions !== 1 && "s"}
                        </div>
                      </div>
                      <CopyLinkButton url={practiceUrl} />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Note Accuracy */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Note Accuracy</h2>
          {sortedNotes.length === 0 ? (
            <Card className="text-center text-muted">
              <p>No practice data yet.</p>
            </Card>
          ) : (
            <Card padding="sm">
              <div className="space-y-2">
                {sortedNotes.map(({ note, accuracy, total }) => (
                  <div key={note} className="flex items-center gap-3">
                    <span className="w-10 font-mono font-bold text-sm">
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
                    <span className="text-sm text-muted w-16 text-right">
                      {accuracy}% ({total})
                    </span>
                  </div>
                ))}
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
                      ? Math.round(
                          (s.total_correct / s.total_questions) * 100
                        )
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

function CopyLinkButton({ url }: { url: string }) {
  return <CopyLinkClient url={url} />;
}

// Separate client component for the copy button
import { CopyLinkClient } from "@/components/teacher/CopyLinkClient";
