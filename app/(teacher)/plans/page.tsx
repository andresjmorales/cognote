import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AssignPlanButton } from "@/components/teacher/AssignPlanButton";

export const metadata = { title: "Lesson Plans" };

export default async function PlansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: plans }, { data: students }] = await Promise.all([
    supabase
      .from("plans")
      .select(
        `
        id, name, is_template, clef, key_signature, notes, questions_per_lesson,
        student_plans ( id, students ( id, name ) )
      `
      )
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("students")
      .select("id, name")
      .eq("teacher_id", user.id)
      .order("name"),
  ]);

  const templates = (plans ?? []).filter((p: any) => p.is_template);
  const studentSpecific = (plans ?? []).filter((p: any) => !p.is_template);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Lesson Plans</h1>
        <Link href="/plans/new">
          <Button size="sm">Create Lesson Plan</Button>
        </Link>
      </div>

      {/* Templates */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Templates</h2>
        {templates.length === 0 ? (
          <Card className="text-center text-muted">
            <p>No templates yet.</p>
            <Link href="/plans/new" className="text-primary text-sm hover:underline">
              Create your first lesson plan template
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map((plan: any) => {
              const noteCount = (plan.notes as string[])?.length ?? 0;
              const assignedStudents = (plan.student_plans ?? [])
                .map((sp: any) => sp.students?.name)
                .filter(Boolean);

              return (
                <Card key={plan.id} padding="sm">
                  <div className="flex justify-between items-start">
                    <Link href={`/plans/${plan.id}`} className="flex-1">
                      <div className="font-semibold hover:text-primary transition-colors">
                        {plan.name}
                      </div>
                      <div className="text-xs text-muted mt-1">
                        {plan.clef} clef · {plan.key_signature} · {noteCount} notes ·{" "}
                        {plan.questions_per_lesson} questions
                      </div>
                      {assignedStudents.length > 0 && (
                        <div className="text-xs text-muted mt-1">
                          Assigned to: {assignedStudents.join(", ")}
                        </div>
                      )}
                    </Link>
                    <AssignPlanButton
                      planId={plan.id}
                      students={students ?? []}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Student-Specific Plans */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Student-Specific Lesson Plans</h2>
        {studentSpecific.length === 0 ? (
          <Card className="text-center text-muted">
            <p>No student-specific plans yet.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {studentSpecific.map((plan: any) => {
              const noteCount = (plan.notes as string[])?.length ?? 0;
              const assignedStudents = (plan.student_plans ?? [])
                .map((sp: any) => sp.students?.name)
                .filter(Boolean);

              return (
                <Card key={plan.id} padding="sm">
                  <div className="flex justify-between items-start">
                    <Link href={`/plans/${plan.id}`} className="flex-1">
                      <div className="font-semibold hover:text-primary transition-colors">
                        {plan.name}
                      </div>
                      <div className="text-xs text-muted mt-1">
                        {plan.clef} clef · {plan.key_signature} · {noteCount} notes
                      </div>
                      {assignedStudents.length > 0 && (
                        <div className="text-xs text-muted mt-1">
                          Assigned to: {assignedStudents.join(", ")}
                        </div>
                      )}
                    </Link>
                    <AssignPlanButton
                      planId={plan.id}
                      students={students ?? []}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
