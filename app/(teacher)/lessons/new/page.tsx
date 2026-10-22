import { createClient } from "@/lib/supabase/server";
import { getPolicy } from "@/lib/server/scheduling";
import { PlanEditor } from "@/components/teacher/PlanEditor";

export const metadata = { title: "New Lesson" };

export default async function NewPlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const policy = await getPolicy(supabase, user.id);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create New Lesson</h1>
      <PlanEditor mode="create" noteNamingSystem={policy.note_naming_system} />
    </div>
  );
}
