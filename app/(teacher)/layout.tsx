import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requiresBetaCode } from "@/lib/entitlements";
import { stringFromUserMetadata } from "@/lib/onboarding";
import { ensureTeacherForAuthUser } from "@/lib/server/ensure-teacher";
import { OnboardingTour } from "@/components/teacher/OnboardingTour";
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

  let { data: teacher } = await supabase
    .from("teachers")
    .select("display_name, avatar_url, onboarding_tour_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!teacher && user.email && !requiresBetaCode()) {
    const serviceClient = createServiceClient();
    await ensureTeacherForAuthUser(serviceClient, {
      userId: user.id,
      email: user.email,
      displayName: stringFromUserMetadata(user.user_metadata, "display_name"),
      timezone: stringFromUserMetadata(user.user_metadata, "timezone"),
    });
    const retry = await supabase
      .from("teachers")
      .select("display_name, avatar_url, onboarding_tour_completed_at")
      .eq("id", user.id)
      .maybeSingle();
    teacher = retry.data;
  }

  const showTour = teacher != null && teacher.onboarding_tour_completed_at == null;

  return (
    <TeacherThemeProvider>
      <TeacherNav
        teacherName={teacher?.display_name ?? user.email ?? "Teacher"}
        avatarUrl={teacher?.avatar_url ?? null}
      />
      <Suspense fallback={null}>
        <OnboardingTour initialShow={showTour} />
      </Suspense>
      <main className="max-w-6xl mx-auto px-4 py-6 min-w-0">{children}</main>
    </TeacherThemeProvider>
  );
}
