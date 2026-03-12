import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  PlanPreviewPlayer,
  type PlanData,
} from "@/components/teacher/PlanPreviewPlayer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("plans")
    .select("name")
    .eq("id", id)
    .single();

  return { title: plan?.name ? `${plan.name} Preview` : "Lesson Preview" };
}

export default async function LessonPreviewPage({
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
    .select(
      `
      name, clef, key_signature, include_sharps, include_flats,
      questions_per_lesson, answer_choices, notes, plan_type,
      symbols, show_hints, key_sig_scale_mode, key_signatures
    `
    )
    .eq("id", id)
    .eq("teacher_id", user.id)
    .single();

  if (!plan) notFound();

  return <PlanPreviewPlayer plan={plan as PlanData} />;
}
