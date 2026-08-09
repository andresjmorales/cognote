import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { AddStudentForm } from "@/components/teacher/AddStudentForm";
import { HostedLimitBanner } from "@/components/teacher/HostedLimitBanner";
import { familyDisplayName } from "@/lib/guardians";
import { ageFromBirthdate } from "@/lib/students";
import { getDeploymentMode, resolveEffectivePlan } from "@/lib/entitlements";
import {
  countActiveStudents,
  loadTeacherEntitlements,
  persistDemotionIfNeeded,
} from "@/lib/server/entitlements";

export const metadata = { title: "Students" };

interface StudentSessionRow {
  id: string;
  total_correct: number;
  total_questions: number;
  started_at: string;
  completed_at: string | null;
}

interface StudentListRow {
  id: string;
  name: string;
  birthdate: string | null;
  parent_contact: string | null;
  archived_at: string | null;
  created_at: string;
  guardians:
    | { name: string; family_name: string | null }[]
    | { name: string; family_name: string | null }
    | null;
  student_plans:
    | {
        id: string;
        plans: { name: string } | null;
        practice_sessions: StudentSessionRow[] | null;
      }[]
    | null;
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const params = await searchParams;
  const showArchived = params.show === "archived";

  let studentsQuery = supabase
    .from("students")
    .select(
      `
        id, name, birthdate, parent_contact, archived_at, created_at,
        guardians ( name, family_name ),
        student_plans (
          id,
          plans ( name ),
          practice_sessions ( id, total_correct, total_questions, started_at, completed_at )
        )
      `
    )
    .eq("teacher_id", user.id)
    .order("name");

  if (showArchived) {
    studentsQuery = studentsQuery.not("archived_at", "is", null);
  } else {
    studentsQuery = studentsQuery.is("archived_at", null);
  }

  const [{ data: studentsData }, { data: guardians }] = await Promise.all([
    studentsQuery,
    supabase
      .from("guardians")
      .select("id, name, family_name")
      .eq("teacher_id", user.id)
      .order("name"),
  ]);

  const students = (studentsData ?? []) as unknown as StudentListRow[];

  const guardianOptions = (guardians ?? []).map((g) => ({
    id: g.id,
    name: familyDisplayName(g),
  }));

  let limitBanner: React.ReactNode = null;
  if (getDeploymentMode() === "hosted") {
    const stored = await loadTeacherEntitlements(supabase, user.id);
    const entitlement = resolveEffectivePlan(stored);
    await persistDemotionIfNeeded(
      supabase,
      user.id,
      stored,
      entitlement.demotedFrom
    );
    if (entitlement.softLimitsApply) {
      const activeCount = await countActiveStudents(supabase, user.id);
      if (activeCount >= entitlement.limits.maxStudents) {
        limitBanner = (
          <HostedLimitBanner
            monthlyPriceCents={entitlement.monthlyPriceCents}
            message={`Free plan allows ${entitlement.limits.maxStudents} active students. Archive one, upgrade to Pro, or export and self-host.`}
          />
        );
      }
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Students</h1>
        <p className="text-muted text-sm mt-1">
          Click a student to see their progress: practice accuracy, skill
          ratings, attendance, and assigned lessons.
        </p>
        <p className="text-xs text-muted mt-2">
          {showArchived ? (
            <Link href="/students" className="text-primary font-semibold">
              Show active
            </Link>
          ) : (
            <Link
              href="/students?show=archived"
              className="text-primary font-semibold"
            >
              Show archived
            </Link>
          )}
        </p>
      </div>

      {limitBanner}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {!students.length ? (
            <Card className="text-center text-muted py-12">
              <div className="text-4xl mb-3">👋</div>
              <p className="text-lg">
                {showArchived ? "No archived students" : "No students yet"}
              </p>
              {!showArchived && (
                <p className="text-sm">Add your first student using the form.</p>
              )}
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {students.map((student) => {
                const allSessions = (student.student_plans ?? []).flatMap(
                  (sp) => sp.practice_sessions ?? []
                );
                const totalSessions = allSessions.length;
                const lastSession = allSessions
                  .sort(
                    (a, b) =>
                      new Date(b.started_at).getTime() -
                      new Date(a.started_at).getTime()
                  )[0];
                const overallCorrect = allSessions.reduce(
                  (sum, s) => sum + (s.total_correct ?? 0),
                  0
                );
                const overallTotal = allSessions.reduce(
                  (sum, s) => sum + (s.total_questions ?? 0),
                  0
                );
                const accuracy =
                  overallTotal > 0
                    ? Math.round((overallCorrect / overallTotal) * 100)
                    : null;
                const age =
                  student.birthdate != null
                    ? ageFromBirthdate(student.birthdate)
                    : null;
                const guardianRow = Array.isArray(student.guardians)
                  ? student.guardians[0]
                  : student.guardians;
                const familyLine = guardianRow
                  ? familyDisplayName(guardianRow)
                  : student.parent_contact || null;
                const subtitle = [familyLine, age !== null ? `age ${age}` : null]
                  .filter(Boolean)
                  .join(" · ");

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
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-lg">
                            {student.name}
                            {student.archived_at && (
                              <span className="ml-2 text-xs font-normal text-muted">
                                Archived
                              </span>
                            )}
                          </div>
                          {subtitle && (
                            <div className="text-sm text-muted">{subtitle}</div>
                          )}
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-muted">
                            {totalSessions} session
                            {totalSessions !== 1 && "s"}
                          </div>
                          {accuracy !== null && (
                            <div
                              className={
                                accuracy >= 80
                                  ? "text-success font-medium"
                                  : accuracy >= 50
                                    ? "text-warning font-medium"
                                    : "text-error font-medium"
                              }
                            >
                              {accuracy}% accuracy
                            </div>
                          )}
                          {lastSession && (
                            <div className="text-muted text-xs">
                              Last:{" "}
                              {new Date(
                                lastSession.started_at
                              ).toLocaleDateString()}
                            </div>
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

        <div>
          <Card>
            <h2 className="font-semibold mb-3">Add Student</h2>
            <AddStudentForm guardians={guardianOptions} />
          </Card>
        </div>
      </div>
    </div>
  );
}
