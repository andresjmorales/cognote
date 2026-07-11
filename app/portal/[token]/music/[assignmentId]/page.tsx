import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { BrandMark } from "@/components/brand/BrandMark";
import { Card } from "@/components/ui/card";
import { ScoreViewer } from "@/components/music/ScoreViewer";
import { getPolicy } from "@/lib/server/scheduling";
import {
  formatLabel,
  LICENSE_LABELS,
} from "@/lib/sheet-music";
import type { MusicFormat, MusicLicenseCode } from "@/lib/supabase/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string; assignmentId: string }>;
}) {
  const { token, assignmentId } = await params;
  const supabase = createServiceClient();
  const { data: guardian } = await supabase
    .from("guardians")
    .select("id, students ( id )")
    .eq("portal_token", token)
    .maybeSingle();
  if (!guardian) return { title: "Sheet Music" };

  const studentIds = new Set(
    ((guardian.students ?? []) as { id: string }[]).map((s) => s.id)
  );
  const { data: assignment } = await supabase
    .from("sheet_music_assignments")
    .select("student_id, unassigned_at, music_library_items ( title )")
    .eq("id", assignmentId)
    .maybeSingle();

  if (
    !assignment ||
    assignment.unassigned_at ||
    !studentIds.has(assignment.student_id)
  ) {
    return { title: "Sheet Music" };
  }

  const title = (
    assignment.music_library_items as unknown as { title: string } | null
  )?.title;
  return { title: title ?? "Sheet Music" };
}

export default async function PortalSheetMusicPage({
  params,
}: {
  params: Promise<{ token: string; assignmentId: string }>;
}) {
  const { token, assignmentId } = await params;
  const supabase = createServiceClient();

  const { data: guardian } = await supabase
    .from("guardians")
    .select("id, teacher_id, students ( id, name )")
    .eq("portal_token", token)
    .maybeSingle();

  if (!guardian) notFound();

  const students = (guardian.students ?? []) as { id: string; name: string }[];
  const studentIds = new Set(students.map((s) => s.id));
  const nameById = new Map(students.map((s) => [s.id, s.name]));

  const { data: assignment } = await supabase
    .from("sheet_music_assignments")
    .select(
      `
      id, student_id, assignment_note, due_date, unassigned_at,
      music_library_items (
        id, title, composer, arranger, format, attribution, license_code, license_url, source_url
      )
    `
    )
    .eq("id", assignmentId)
    .maybeSingle();

  if (
    !assignment ||
    assignment.unassigned_at ||
    !studentIds.has(assignment.student_id)
  ) {
    notFound();
  }

  const item = assignment.music_library_items as unknown as {
    id: string;
    title: string;
    composer: string;
    arranger: string;
    format: MusicFormat;
    attribution: string;
    license_code: MusicLicenseCode;
    license_url: string | null;
    source_url: string | null;
  } | null;

  if (!item) notFound();

  const policy = await getPolicy(supabase, guardian.teacher_id);
  const fileUrl = `/api/portal/${token}/music/${assignmentId}/file`;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-surface border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-2">
          <BrandMark size={28} className="h-7 w-7" />
          <span className="text-lg font-bold text-primary tracking-tight">
            {policy.studio_name || "CogNote"}
          </span>
          <span className="text-muted text-sm ml-2">Sheet Music</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div>
          <Link
            href={`/portal/${token}`}
            className="text-sm text-muted hover:text-foreground"
          >
            ← Family portal
          </Link>
          <h1 className="text-2xl font-bold mt-2">{item.title}</h1>
          <p className="text-sm text-muted mt-1">
            {[
              nameById.get(assignment.student_id),
              item.composer || null,
              item.arranger ? `arr. ${item.arranger}` : null,
              formatLabel(item.format),
              LICENSE_LABELS[item.license_code],
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {assignment.due_date && (
            <p className="text-sm text-muted mt-1">Due {assignment.due_date}</p>
          )}
          {assignment.assignment_note && (
            <p className="text-sm mt-2 whitespace-pre-wrap">
              {assignment.assignment_note}
            </p>
          )}
          {item.attribution && (
            <p className="text-xs text-muted mt-2">{item.attribution}</p>
          )}
        </div>

        <div className="flex gap-2">
          <a
            href={`${fileUrl}?download=1`}
            className="inline-flex items-center justify-center font-semibold bg-surface border border-border text-foreground hover:border-primary/50 px-4 py-2 text-sm rounded-lg transition-colors"
          >
            Download
          </a>
        </div>

        <Card>
          <ScoreViewer format={item.format} fileUrl={fileUrl} />
        </Card>
      </main>
    </div>
  );
}
