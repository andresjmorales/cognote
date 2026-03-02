import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { AssignPlanButton } from "@/components/teacher/AssignPlanButton";
import { PlanEditWrapper } from "@/components/teacher/PlanEditWrapper";

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
  const symbols = (plan.symbols as any[]) ?? [];
  const isSymbolPlan = plan.plan_type === "symbol_concepts";
  const difficultyLabel = (plan.difficulty as string)?.charAt(0).toUpperCase() + (plan.difficulty as string)?.slice(1);

  return (
    <PlanEditWrapper
      planId={id}
      initialData={{
        name: plan.name,
        is_template: plan.is_template,
        plan_type: plan.plan_type ?? "note_identification",
        clef: plan.clef,
        key_signature: plan.key_signature,
        include_sharps: plan.include_sharps,
        include_flats: plan.include_flats,
        measures_shown: plan.measures_shown,
        questions_per_lesson: plan.questions_per_lesson,
        answer_choices: plan.answer_choices,
        notes,
        symbols,
        difficulty: plan.difficulty ?? "beginner",
        teacher_notes: plan.teacher_notes ?? "",
      }}
    >
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/plans" className="text-muted hover:text-foreground">
            ← Plans
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{plan.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                isSymbolPlan ? "bg-accent/20 text-accent" : "bg-primary/10 text-primary"
              }`}>
                {isSymbolPlan ? "Symbols & Concepts" : "Note Identification"}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-dim text-muted font-medium">
                {difficultyLabel}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <AssignPlanButton planId={plan.id} students={students ?? []} />
          </div>
        </div>

        {plan.teacher_notes && (
          <Card padding="sm" className="mb-4 bg-surface-dim/50">
            <div className="text-xs text-muted mb-1">Teacher Notes</div>
            <p className="text-sm whitespace-pre-wrap">{plan.teacher_notes}</p>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {!isSymbolPlan && (
            <>
              <Card padding="sm">
                <div className="text-xs text-muted">Clef</div>
                <div className="font-semibold capitalize">{plan.clef}</div>
              </Card>
              <Card padding="sm">
                <div className="text-xs text-muted">Key Signature</div>
                <div className="font-semibold">{plan.key_signature}</div>
              </Card>
            </>
          )}
          <Card padding="sm">
            <div className="text-xs text-muted">Questions per Lesson</div>
            <div className="font-semibold">{plan.questions_per_lesson}</div>
          </Card>
          <Card padding="sm">
            <div className="text-xs text-muted">Answer Choices</div>
            <div className="font-semibold">{plan.answer_choices}</div>
          </Card>
        </div>

        {isSymbolPlan ? (
          <Card className="mb-6">
            <h2 className="font-semibold mb-2">Symbols &amp; Concepts ({symbols.length})</h2>
            <div className="space-y-1.5">
              {symbols.map((sym: any) => (
                <div key={sym.id} className="flex items-center gap-3 py-1">
                  <span className="text-lg w-12 text-center">{sym.symbol}</span>
                  <div>
                    <span className="font-medium text-sm">{sym.term}</span>
                    <span className="text-muted text-xs ml-2">{sym.definition}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : (
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
        )}

        <Card>
          <h2 className="font-semibold mb-3">Assigned Students</h2>
          {!studentPlans?.length ? (
            <p className="text-muted text-sm">No students assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {(studentPlans as any[]).map((sp) => (
                <div key={sp.id} className="flex justify-between items-center py-1.5">
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
    </PlanEditWrapper>
  );
}
