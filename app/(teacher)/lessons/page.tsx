import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AssignPlanButton } from "@/components/teacher/AssignPlanButton";
import { LaunchPlanButton } from "@/components/teacher/LaunchPlanButton";
import { isActiveStudentPlan } from "@/lib/student-plans";

export const metadata = { title: "Lessons" };

interface PlanListRow {
  id: string;
  name: string;
  is_template: boolean;
  clef: string;
  key_signature: string;
  notes: string[] | null;
  questions_per_lesson: number;
  plan_type: string;
  symbols: unknown[] | null;
  key_signatures: string[] | null;
  labels: string[] | null;
  student_plans:
    | {
        id: string;
        unassigned_at: string | null;
        students: { id: string; name: string } | null;
      }[]
    | null;
}

function PlanCard({
  plan,
  students,
}: {
  plan: PlanListRow;
  students: { id: string; name: string }[];
}) {
  const isSymbolPlan = plan.plan_type === "symbol_concepts";
  const isKeySigPlan = plan.plan_type === "key_signature_identification";
  const noteCount = plan.notes?.length ?? 0;
  const symbolCount = plan.symbols?.length ?? 0;
  const keySigCount = plan.key_signatures?.length ?? 0;
  const labels = plan.labels ?? [];
  const activeAssignments = (plan.student_plans ?? []).filter(isActiveStudentPlan);
  const assignedStudentIds = new Set(
    activeAssignments
      .map((sp) => sp.students?.id)
      .filter((studentId): studentId is string => typeof studentId === "string")
  );
  const assignedStudents = activeAssignments
    .map((sp) => sp.students?.name)
    .filter(Boolean);

  return (
    <Card padding="sm">
      <div className="flex justify-between items-start">
        <Link href={`/lessons/${plan.id}`} className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="font-semibold hover:text-primary transition-colors max-w-full truncate"
              title={plan.name}
            >
              {plan.name}
            </span>
            {labels.map((label) => (
              <span
                key={label}
                className="text-[11px] px-2 py-0.5 rounded-full bg-surface-dim text-muted font-medium"
              >
                {label}
              </span>
            ))}
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
          <AssignPlanButton
            planId={plan.id}
            students={students.map((student) => ({
              ...student,
              assigned: assignedStudentIds.has(student.id),
            }))}
          />
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
        plan_type, symbols, key_signatures, labels,
        student_plans ( id, unassigned_at, students ( id, name ) )
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

  const planRows = (plans ?? []) as unknown as PlanListRow[];
  const templates = planRows.filter((p) => p.is_template);
  const studentSpecific = planRows.filter((p) => !p.is_template);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Lessons</h1>
          <p className="text-muted text-sm mt-1">
            Practice lessons students open by link. Each one includes a quiz,
            flashcards, and free practice built from the notes and symbols you
            pick.
          </p>
        </div>
        <Link href="/lessons/new" className="shrink-0">
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
            {templates.map((plan) => (
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
            {studentSpecific.map((plan) => (
              <PlanCard key={plan.id} plan={plan} students={students ?? []} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
