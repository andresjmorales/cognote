import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { UploadMusicForm } from "@/components/music/UploadMusicForm";
import { AssignSheetMusicButton } from "@/components/music/AssignSheetMusicButton";
import { MusicLibraryFilters } from "@/components/music/MusicLibraryFilters";
import { FindScoresPanel } from "@/components/music/FindScoresPanel";
import {
  formatLabel,
  isActiveSheetMusicAssignment,
  LICENSE_LABELS,
} from "@/lib/sheet-music";
import { oneToOne } from "@/lib/schedule";
import type { MusicFormat, MusicLicenseCode } from "@/lib/supabase/types";

export const metadata = { title: "Music Library" };

export default async function MusicLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; format?: string; tag?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: items }, { data: students }] = await Promise.all([
    supabase
      .from("music_library_items")
      .select(
        `
        id, title, composer, arranger, format, tags, license_code, attribution,
        created_at,
        sheet_music_assignments ( id, student_id, unassigned_at, students ( id, name ) )
      `
      )
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("students")
      .select("id, name")
      .eq("teacher_id", user.id)
      .order("name"),
  ]);

  const q = (params.q ?? "").trim().toLowerCase();
  const formatFilter = params.format;
  const tagFilter = (params.tag ?? "").trim().toLowerCase();

  const allTags = Array.from(
    new Set((items ?? []).flatMap((item) => item.tags ?? []))
  ).sort();

  const filtered = (items ?? []).filter((item) => {
    if (formatFilter === "pdf" || formatFilter === "musicxml" || formatFilter === "mxl") {
      if (item.format !== formatFilter) return false;
    }
    if (tagFilter && !(item.tags ?? []).includes(tagFilter)) return false;
    if (q) {
      const hay =
        `${item.title} ${item.composer} ${item.arranger} ${(item.tags ?? []).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const studentList = students ?? [];

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Music Library</h1>
          <p className="text-muted text-sm mt-1">
            Upload PDFs and MusicXML scores, or find free public-domain / CC scores,
            then assign them to students. Families view them in the portal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FindScoresPanel />
          <UploadMusicForm />
        </div>
      </div>

      <div className="mb-4">
        <Suspense fallback={null}>
          <MusicLibraryFilters allTags={allTags} />
        </Suspense>
      </div>

      {filtered.length === 0 ? (
        <Card className="text-center text-muted">
          {(items ?? []).length === 0
            ? "No scores yet. Upload a PDF or MusicXML file to get started."
            : "No scores match these filters."}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {filtered.map((item) => {
            const active = (item.sheet_music_assignments ?? []).filter(
              isActiveSheetMusicAssignment
            );
            const assignedIds = new Set(
              active
                .map((a) => oneToOne(a.students)?.id ?? a.student_id)
                .filter((id): id is string => typeof id === "string")
            );
            const assignedNames = active
              .map((a) => oneToOne(a.students)?.name)
              .filter(Boolean);

            return (
              <Card key={item.id} padding="sm">
                <div className="flex justify-between items-start gap-3">
                  <Link href={`/music/${item.id}`} className="flex-1 min-w-0">
                    <div className="font-semibold hover:text-primary transition-colors truncate">
                      {item.title}
                    </div>
                    <div className="text-xs text-muted mt-1">
                      {[
                        item.composer || null,
                        formatLabel(item.format as MusicFormat),
                        LICENSE_LABELS[item.license_code as MusicLicenseCode] ??
                          item.license_code,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {(item.tags ?? []).length > 0 && (
                      <div className="text-xs text-muted mt-1">
                        {(item.tags ?? []).join(", ")}
                      </div>
                    )}
                    {assignedNames.length > 0 && (
                      <div className="text-xs text-muted mt-1">
                        Assigned to: {assignedNames.join(", ")}
                      </div>
                    )}
                  </Link>
                  <AssignSheetMusicButton
                    musicItemId={item.id}
                    students={studentList.map((s) => ({
                      ...s,
                      assigned: assignedIds.has(s.id),
                    }))}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
