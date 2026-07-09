import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { FamilyDetailActions } from "@/components/teacher/FamilyDetailActions";
import type { FamilyGuardian } from "@/components/teacher/FamilyForm";
import { familyDisplayName } from "@/lib/guardians";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: guardian } = await supabase
    .from("guardians")
    .select("name, family_name")
    .eq("id", id)
    .single();
  return { title: guardian ? familyDisplayName(guardian) : "Family" };
}

const DAY_NAMES = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

function formatSlotTime(time: string): string {
  const [hh, mm] = time.split(":").map(Number);
  const period = hh >= 12 ? "PM" : "AM";
  const hour = hh % 12 === 0 ? 12 : hh % 12;
  return `${hour}:${String(mm).padStart(2, "0")} ${period}`;
}

export default async function FamilyDetailPage({
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

  const [{ data: guardian }, { data: allStudents }] = await Promise.all([
    supabase
      .from("guardians")
      .select(
        "id, name, family_name, email, phone, secondary_name, secondary_email, secondary_phone, email_recipients, portal_token, created_at"
      )
      .eq("id", id)
      .eq("teacher_id", user.id)
      .single(),
    supabase
      .from("students")
      .select("id, name, guardian_id")
      .eq("teacher_id", user.id)
      .order("name"),
  ]);

  if (!guardian) notFound();

  const students = allStudents ?? [];
  const members = students.filter((s) => s.guardian_id === guardian.id);

  interface MemberSlot {
    student_id: string;
    day_of_week: number;
    start_time: string;
    duration_minutes: number;
    active: boolean;
  }

  let slots: MemberSlot[] = [];
  if (members.length > 0) {
    const { data } = await supabase
      .from("lesson_slots")
      .select("student_id, day_of_week, start_time, duration_minutes, active")
      .in(
        "student_id",
        members.map((m) => m.id)
      )
      .order("day_of_week")
      .order("start_time");
    slots = (data ?? []) as MemberSlot[];
  }

  const slotsByStudent = new Map<string, MemberSlot[]>();
  for (const slot of slots) {
    const list = slotsByStudent.get(slot.student_id) ?? [];
    list.push(slot);
    slotsByStudent.set(slot.student_id, list);
  }

  const secondGuardianContact = [guardian.secondary_email, guardian.secondary_phone]
    .filter(Boolean)
    .join(" · ");

  const emailRoutingLabel =
    guardian.email_recipients === "both"
      ? "Both guardians receive family emails"
      : guardian.email_recipients === "secondary"
        ? `Family emails go to ${guardian.secondary_name || "the second guardian"}`
        : guardian.secondary_email
          ? `Family emails go to ${guardian.name}`
          : null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/families" className="text-muted hover:text-foreground">
          ← Families
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">{familyDisplayName(guardian)}</h1>
          <p className="text-muted text-sm">
            {members.length > 0
              ? `${members.length} student${members.length !== 1 ? "s" : ""}`
              : "No students linked yet"}
          </p>
        </div>
      </div>

      <FamilyDetailActions
        guardian={guardian as FamilyGuardian}
        students={students}
      />

      {/* Contact info */}
      <Card padding="sm" className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted font-medium mb-0.5">Guardian</div>
            <div className="font-medium text-sm">{guardian.name}</div>
            <div className="text-sm text-muted">
              {[guardian.email, guardian.phone].filter(Boolean).join(" · ") ||
                "No contact info"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted font-medium mb-0.5">
              Second Guardian
            </div>
            {guardian.secondary_name || secondGuardianContact ? (
              <>
                <div className="font-medium text-sm">
                  {guardian.secondary_name || "—"}
                </div>
                <div className="text-sm text-muted">
                  {secondGuardianContact || "No contact info"}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted">
                None — add one with Edit Family
              </div>
            )}
          </div>
        </div>
        {emailRoutingLabel && (
          <p className="text-xs text-muted mt-3 pt-3 border-t border-border">
            {emailRoutingLabel}
          </p>
        )}
      </Card>

      {/* Students */}
      <h2 className="text-lg font-semibold mb-3">Students</h2>
      {members.length === 0 ? (
        <Card className="text-center text-muted py-8">
          <p>No students in this family yet.</p>
          <p className="text-sm mt-1">
            Use Edit Family to link existing students or add new ones.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {members.map((student) => {
            const studentSlots = slotsByStudent.get(student.id) ?? [];
            return (
              <Link
                key={student.id}
                href={`/students/${student.id}`}
                className="block"
              >
                <Card
                  padding="sm"
                  className="hover:border-primary/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{student.name}</div>
                    <div className="text-right text-sm text-muted">
                      {studentSlots.length > 0 ? (
                        studentSlots.map((slot, i) => (
                          <div key={i}>
                            {DAY_NAMES[slot.day_of_week]}{" "}
                            {formatSlotTime(slot.start_time)} ·{" "}
                            {slot.duration_minutes} min
                            {!slot.active && " (paused)"}
                          </div>
                        ))
                      ) : (
                        <span>No weekly slot</span>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
