import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ScoreViewer } from "@/components/music/ScoreViewer";
import { AssignSheetMusicButton } from "@/components/music/AssignSheetMusicButton";
import { MusicMetadataPanel } from "@/components/music/MusicMetadataPanel";
import { UnassignSheetMusicButton } from "@/components/music/UnassignSheetMusicButton";
import {
  formatLabel,
  isActiveSheetMusicAssignment,
  LICENSE_LABELS,
} from "@/lib/sheet-music";
import { oneToOne } from "@/lib/schedule";
import type { MusicFormat, MusicLicenseCode } from "@/lib/supabase/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("music_library_items")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  return { title: data?.title ?? "Score" };
}

export default async function MusicItemPage({
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

  const [{ data: item }, { data: students }] = await Promise.all([
    supabase
      .from("music_library_items")
      .select(
        `
        id, title, composer, arranger, format, tags, license_code, license_url,
        source, source_url, attribution, original_filename, byte_size, created_at,
        sheet_music_assignments (
          id, student_id, assignment_note, due_date, assigned_at, unassigned_at, emailed_at,
          students ( id, name )
        )
      `
      )
      .eq("id", id)
      .eq("teacher_id", user.id)
      .maybeSingle(),
    supabase
      .from("students")
      .select("id, name")
      .eq("teacher_id", user.id)
      .order("name"),
  ]);

  if (!item) notFound();

  const active = (item.sheet_music_assignments ?? []).filter(
    isActiveSheetMusicAssignment
  );
  const assignedIds = new Set(active.map((a) => a.student_id));
  const fileUrl = `/api/music/${item.id}/file`;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-end gap-2 mb-2">
          <a
            href={`${fileUrl}?download=1`}
            className="inline-flex items-center justify-center font-semibold bg-surface text-foreground border border-border hover:bg-surface-dim px-3 py-1.5 text-sm rounded-lg transition-colors"
          >
            Download
          </a>
          <AssignSheetMusicButton
            musicItemId={item.id}
            students={(students ?? []).map((s) => ({
              ...s,
              assigned: assignedIds.has(s.id),
            }))}
          />
        </div>
        <Link href="/music" className="text-sm text-muted hover:text-foreground">
          ← Music Library
        </Link>
        <div className="mt-2">
          <h1 className="text-2xl font-bold">{item.title}</h1>
          <p className="text-sm text-muted mt-1">
            {[
              item.composer || null,
              item.arranger ? `arr. ${item.arranger}` : null,
              formatLabel(item.format as MusicFormat),
              LICENSE_LABELS[item.license_code as MusicLicenseCode],
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {item.attribution && (
            <p className="text-xs text-muted mt-1">{item.attribution}</p>
          )}
        </div>
      </div>

      <Card>
        <MusicMetadataPanel
          item={{
            id: item.id,
            title: item.title,
            composer: item.composer,
            arranger: item.arranger,
            tags: item.tags ?? [],
            license_code: item.license_code as MusicLicenseCode,
            license_url: item.license_url,
            source: item.source,
            source_url: item.source_url,
            attribution: item.attribution,
            original_filename: item.original_filename,
            byte_size: item.byte_size,
          }}
        />
      </Card>

      <Card>
        <h2 className="font-semibold mb-3">Score</h2>
        <ScoreViewer format={item.format as MusicFormat} fileUrl={fileUrl} />
      </Card>

      <Card>
        <h2 className="font-semibold mb-3">Assigned students</h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted">Not assigned to anyone yet.</p>
        ) : (
          <div className="space-y-2">
            {active.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 border-b border-border last:border-0 pb-2 last:pb-0"
              >
                <div>
                  <div className="font-medium text-sm">
                    {oneToOne(a.students)?.name ?? "Student"}
                  </div>
                  {a.assignment_note && (
                    <p className="text-xs text-muted mt-0.5">{a.assignment_note}</p>
                  )}
                  <p className="text-xs text-muted mt-0.5">
                    {[
                      a.due_date ? `Due ${a.due_date}` : null,
                      a.emailed_at ? "Emailed" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Assigned"}
                  </p>
                </div>
                <UnassignSheetMusicButton assignmentId={a.id} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
