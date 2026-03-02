import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { AssignPlanButton } from "@/components/teacher/AssignPlanButton";

export default async function PlanDetailPage({
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

  const { data: plan } = await supabase
    .from("plans")
    .select("*")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .single();

  if (!plan) notFound();

  const { data: studentPlans } = await supabase
    .from("student_plans")
    .select("id, token, assigned_at, students ( id, name )")
    .eq("plan_id", id);

  const { data: students } = await supabase
    .from("students")
    .select("id, name")
    .eq("teacher_id", user.id)
    .order("name");

  const notes = (plan.notes as string[]) ?? [];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/plans" className="text-muted hover:text-foreground">
          ← Plans
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{plan.name}</h1>
        {plan.is_template && (
          <AssignPlanButton planId={plan.id} students={students ?? []} />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card padding="sm">
          <div className="text-xs text-muted">Clef</div>
          <div className="font-semibold capitalize">{plan.clef}</div>
        </Card>
        <Card padding="sm">
          <div className="text-xs text-muted">Key Signature</div>
          <div className="font-semibold">{plan.key_signature}</div>
        </Card>
        <Card padding="sm">
          <div className="text-xs text-muted">Questions per Lesson</div>
          <div className="font-semibold">{plan.questions_per_lesson}</div>
        </Card>
        <Card padding="sm">
          <div className="text-xs text-muted">Answer Choices</div>
          <div className="font-semibold">{plan.answer_choices}</div>
        </Card>
      </div>

      <Card className="mb-6">
        <h2 className="font-semibold mb-2">Notes ({notes.length})</h2>
        <div className="flex flex-wrap gap-1.5">
          {notes.map((note: string) => (
            <span
              key={note}
              className="px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-sm font-mono font-semibold"
            >
              {note}
            </span>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold mb-3">Assigned Students</h2>
        {!studentPlans?.length ? (
          <p className="text-muted text-sm">No students assigned yet.</p>
        ) : (
          <div className="space-y-2">
            {(studentPlans as any[]).map((sp) => (
              <div
                key={sp.id}
                className="flex justify-between items-center py-1.5"
              >
                <Link
                  href={`/students/${sp.students?.id}`}
                  className="text-sm font-medium hover:text-primary"
                >
                  {sp.students?.name}
                </Link>
                <span className="text-xs text-muted">
                  {new Date(sp.assigned_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
