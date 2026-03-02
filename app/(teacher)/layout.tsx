import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeacherNav } from "@/components/teacher/TeacherNav";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: teacher } = await supabase
    .from("teachers")
    .select("display_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-background">
      <TeacherNav
        teacherName={teacher?.display_name ?? user.email ?? "Teacher"}
      />
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
