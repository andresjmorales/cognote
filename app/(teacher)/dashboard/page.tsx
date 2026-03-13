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
          <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted">Students</div>
              <span className="text-muted text-xs group-hover:text-primary transition-colors">View all →</span>
            </div>
            <div className="text-3xl font-bold mt-1">{students?.length ?? 0}</div>
          </Card>
        </Link>
        <Link href="/lessons">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted">Lessons</div>
              <span className="text-muted text-xs group-hover:text-primary transition-colors">View all →</span>
            </div>
            <div className="text-3xl font-bold mt-1">{plans?.length ?? 0}</div>
          </Card>
        </Link>
        <Card>
          <div className="text-sm text-muted">Sessions This Week</div>
          <div className="text-3xl font-bold mt-1">
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
            <div className="flex flex-col gap-3">
              {students.map((s) => (
                <Link key={s.id} href={`/students/${s.id}`} className="block">
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
