import { PlanEditor } from "@/components/teacher/PlanEditor";

export default function NewPlanPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create New Plan</h1>
      <PlanEditor mode="create" />
    </div>
  );
}
