import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: students }, { data: plans }, { data: recentSessions }] =
    await Promise.all([
      supabase
        .from("students")
        .select("id, name, created_at")
        .eq("teacher_id", user.id)
        .order("name"),
      supabase
        .from("plans")
        .select("id, name, is_template")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false }),
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
    ]);

  const teacherSessions = (recentSessions ?? []).filter(
    (s: any) => s.student_plans?.students?.teacher_id === user.id
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Link href="/plans/new">
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
        <Card>
          <div className="text-sm text-muted">Students</div>
          <div className="text-3xl font-bold">{students?.length ?? 0}</div>
        </Card>
        <Card>
          <div className="text-sm text-muted">Lessons</div>
          <div className="text-3xl font-bold">{plans?.length ?? 0}</div>
        </Card>
        <Card>
          <div className="text-sm text-muted">Sessions This Week</div>
          <div className="text-3xl font-bold">
            {teacherSessions.filter((s: any) => {
              const d = new Date(s.started_at);
              const weekAgo = new Date();
              weekAgo.setDate(weekAgo.getDate() - 7);
              return d > weekAgo;
            }).length}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-3">Students</h2>
          {!students?.length ? (
            <Card className="text-center text-muted">
              <p>No students yet.</p>
              <Link href="/students" className="text-primary text-sm hover:underline">
                Add your first student
              </Link>
            </Card>
          ) : (
            <div className="space-y-2">
              {students.map((s) => (
                <Link key={s.id} href={`/students/${s.id}`}>
                  <Card
                    padding="sm"
                    className="hover:border-primary/40 transition-colors cursor-pointer"
                  >
                    <div className="font-medium">{s.name}</div>
                  </Card>
                </Link>
              ))}
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
            <div className="space-y-2">
              {teacherSessions.slice(0, 5).map((s: any) => {
                const pct =
                  s.total_questions > 0
                    ? Math.round((s.total_correct / s.total_questions) * 100)
                    : 0;
                return (
                  <Card key={s.id} padding="sm">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">
                          {s.student_plans?.students?.name}
                        </span>
                        <span className="text-muted text-sm ml-2">
                          {s.student_plans?.plans?.name}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span
                          className={
                            pct >= 80
                              ? "text-success"
                              : pct >= 50
                                ? "text-warning"
                                : "text-error"
                          }
                        >
                          {pct}%
                        </span>
                        <span className="text-muted ml-2">
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
