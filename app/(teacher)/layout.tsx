import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeacherNav } from "@/components/teacher/TeacherNav";
import { TeacherThemeProvider } from "@/components/teacher/TeacherThemeProvider";

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
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <TeacherThemeProvider>
      <TeacherNav
        teacherName={teacher?.display_name ?? user.email ?? "Teacher"}
        avatarUrl={teacher?.avatar_url ?? null}
      />
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </TeacherThemeProvider>
  );
}
