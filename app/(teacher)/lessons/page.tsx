import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AssignPlanButton } from "@/components/teacher/AssignPlanButton";
import { LaunchPlanButton } from "@/components/teacher/LaunchPlanButton";

export const metadata = { title: "Lessons" };

function PlanCard({ plan, students }: { plan: any; students: { id: string; name: string }[] }) {
  const isSymbolPlan = plan.plan_type === "symbol_concepts";
  const isKeySigPlan = plan.plan_type === "key_signature_identification";
  const noteCount = (plan.notes as string[])?.length ?? 0;
  const symbolCount = (plan.symbols as any[])?.length ?? 0;
  const keySigCount = (plan.key_signatures as string[])?.length ?? 0;
  const assignedStudents = (plan.student_plans ?? [])
    .map((sp: any) => sp.students?.name)
    .filter(Boolean);

  return (
    <Card padding="sm">
      <div className="flex justify-between items-start">
        <Link href={`/lessons/${plan.id}`} className="flex-1">
          <div className="font-semibold hover:text-primary transition-colors">
            {plan.name}
          </div>
          <div className="text-xs text-muted mt-1">
            {isSymbolPlan
              ? `${symbolCount} symbol${symbolCount !== 1 ? "s" : ""} · ${plan.questions_per_lesson} questions`
              : isKeySigPlan
                ? `${plan.clef} clef · ${keySigCount} key signature${keySigCount !== 1 ? "s" : ""} · ${plan.questions_per_lesson} questions`
                : `${plan.clef} clef · ${noteCount} note${noteCount !== 1 ? "s" : ""} · ${plan.questions_per_lesson} questions`}
          </div>
          {assignedStudents.length > 0 && (
            <div className="text-xs text-muted mt-1">
              Assigned to: {assignedStudents.join(", ")}
            </div>
          )}
        </Link>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <LaunchPlanButton planId={plan.id} planName={plan.name} students={students} />
          <AssignPlanButton planId={plan.id} students={students} />
        </div>
      </div>
    </Card>
  );
}

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
        plan_type, symbols, key_signatures,
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
        <h1 className="text-2xl font-bold">Lessons</h1>
        <Link href="/lessons/new">
          <Button size="sm">Create Lesson</Button>
        </Link>
      </div>

      {/* Templates */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Templates</h2>
        {templates.length === 0 ? (
          <Card className="text-center text-muted">
            <p>No templates yet.</p>
            <Link href="/lessons/new" className="text-primary text-sm hover:underline">
              Create your first lesson template
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map((plan: any) => (
              <PlanCard key={plan.id} plan={plan} students={students ?? []} />
            ))}
          </div>
        )}
      </section>

      {/* Student-Specific Plans */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Student-Specific Lessons</h2>
        {studentSpecific.length === 0 ? (
          <Card className="text-center text-muted">
            <p>No student-specific plans yet.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {studentSpecific.map((plan: any) => (
              <PlanCard key={plan.id} plan={plan} students={students ?? []} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
