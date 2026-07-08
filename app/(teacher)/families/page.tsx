import { createClient } from "@/lib/supabase/server";
import { FamiliesManager } from "@/components/teacher/FamiliesManager";

export const metadata = { title: "Families" };

export default async function FamiliesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: guardians }, { data: students }] = await Promise.all([
    supabase
      .from("guardians")
      .select("id, name, email, phone, portal_token, created_at")
      .eq("teacher_id", user.id)
      .order("name"),
    supabase
      .from("students")
      .select("id, name, guardian_id")
      .eq("teacher_id", user.id)
      .order("name"),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Families</h1>
        <p className="text-muted text-sm mt-1">
          Each family gets a private portal link with practice links, the lesson
          schedule, and your shared notes. No parent accounts needed, and
          siblings share one family.
        </p>
      </div>
      <FamiliesManager guardians={guardians ?? []} students={students ?? []} />
    </div>
  );
}
