import { PlanEditor } from "@/components/teacher/PlanEditor";

export const metadata = { title: "New Lesson Plan" };

export default function NewPlanPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create New Lesson Plan</h1>
      <PlanEditor mode="create" />
    </div>
  );
}
