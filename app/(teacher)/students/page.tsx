import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { AddStudentForm } from "@/components/teacher/AddStudentForm";

export const metadata = { title: "Students" };

export default async function StudentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: students } = await supabase
    .from("students")
    .select(
      `
      id, name, parent_contact, created_at,
      student_plans (
        id,
        plans ( name ),
        practice_sessions ( id, total_correct, total_questions, started_at, completed_at )
      )
    `
    )
    .eq("teacher_id", user.id)
    .order("name");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Students</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {!students?.length ? (
            <Card className="text-center text-muted py-12">
              <div className="text-4xl mb-3">👋</div>
              <p className="text-lg">No students yet</p>
              <p className="text-sm">Add your first student using the form.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {students.map((student: any) => {
                const allSessions = (student.student_plans ?? []).flatMap(
                  (sp: any) => sp.practice_sessions ?? []
                );
                const totalSessions = allSessions.length;
                const lastSession = allSessions
                  .sort(
                    (a: any, b: any) =>
                      new Date(b.started_at).getTime() -
                      new Date(a.started_at).getTime()
                  )[0];
                const overallCorrect = allSessions.reduce(
                  (sum: number, s: any) => sum + (s.total_correct ?? 0),
                  0
                );
                const overallTotal = allSessions.reduce(
                  (sum: number, s: any) => sum + (s.total_questions ?? 0),
                  0
                );
                const accuracy =
                  overallTotal > 0
                    ? Math.round((overallCorrect / overallTotal) * 100)
                    : null;

                return (
                  <Link key={student.id} href={`/students/${student.id}`} className="block">
                    <Card
                      padding="sm"
                      className="hover:border-primary/40 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-lg">
                            {student.name}
                          </div>
                          {student.parent_contact && (
                            <div className="text-sm text-muted">
                              {student.parent_contact}
                            </div>
                          )}
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-muted">
                            {totalSessions} session{totalSessions !== 1 && "s"}
                          </div>
                          {accuracy !== null && (
                            <div
                              className={
                                accuracy >= 80
                                  ? "text-success font-medium"
                                  : accuracy >= 50
                                    ? "text-warning font-medium"
                                    : "text-error font-medium"
                              }
                            >
                              {accuracy}% accuracy
                            </div>
                          )}
                          {lastSession && (
                            <div className="text-muted text-xs">
                              Last:{" "}
                              {new Date(
                                lastSession.started_at
                              ).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <Card>
            <h2 className="font-semibold mb-3">Add Student</h2>
            <AddStudentForm />
          </Card>
        </div>
      </div>
    </div>
  );
}
