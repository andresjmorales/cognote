import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SEED_TEACHER } from "./helpers/auth";

/**
 * RLS isolation: a signed-in teacher must never read or write another
 * teacher's rows, and the anonymous role must have no access to app tables.
 *
 * Talks to Supabase directly (PostgREST), bypassing the Next app, so it
 * exercises the database policies themselves. Requires the local stack with
 * seed data and NEXT_PUBLIC_SUPABASE_ANON_KEY in the environment (CI sets it;
 * locally: eval "$(npx supabase status -o env)" or export it manually).
 */

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const SEED_TEACHER_ID = "00000000-0000-0000-0000-000000000001";

function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

test.describe("RLS tenant isolation", () => {
  test.skip(
    !ANON_KEY,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY not set; export Supabase env before running"
  );

  let teacherA: SupabaseClient;
  let teacherB: SupabaseClient;
  let studentIdOfA: string;

  test.beforeAll(async () => {
    // Teacher A: the seeded studio with real data.
    teacherA = anonClient();
    const signInA = await teacherA.auth.signInWithPassword({
      email: SEED_TEACHER.email,
      password: SEED_TEACHER.password,
    });
    expect(signInA.error).toBeNull();

    // Teacher B: a brand-new account with no studio (local auth autoconfirms).
    teacherB = anonClient();
    const signUpB = await teacherB.auth.signUp({
      email: `rls-isolation-${Date.now()}@example.com`,
      password: "password123!",
    });
    expect(signUpB.error).toBeNull();
    expect(signUpB.data.session).not.toBeNull();
  });

  test("seed teacher sees their own students", async () => {
    const { data, error } = await teacherA
      .from("students")
      .select("id, teacher_id")
      .limit(5);
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    for (const row of data!) expect(row.teacher_id).toBe(SEED_TEACHER_ID);
    studentIdOfA = data![0].id;
  });

  test("another teacher cannot read the seed studio's rows", async () => {
    for (const table of [
      "students",
      "guardians",
      "plans",
      "lessons",
      "invoices",
      "studio_policies",
    ]) {
      const { data, error } = await teacherB.from(table).select("*").limit(5);
      expect(error, `${table}: unexpected error`).toBeNull();
      expect(data, `${table}: cross-tenant rows leaked`).toEqual([]);
    }

    const byId = await teacherB
      .from("students")
      .select("*")
      .eq("id", studentIdOfA)
      .maybeSingle();
    expect(byId.error).toBeNull();
    expect(byId.data).toBeNull();
  });

  test("another teacher cannot write the seed studio's rows", async () => {
    const update = await teacherB
      .from("students")
      .update({ name: "Hacked" })
      .eq("id", studentIdOfA)
      .select();
    // RLS silently filters the row: no error, but nothing updated.
    expect(update.data ?? []).toEqual([]);

    const del = await teacherB
      .from("students")
      .delete()
      .eq("id", studentIdOfA)
      .select();
    expect(del.data ?? []).toEqual([]);

    // Verify the row is untouched from A's perspective.
    const check = await teacherA
      .from("students")
      .select("name")
      .eq("id", studentIdOfA)
      .single();
    expect(check.error).toBeNull();
    expect(check.data!.name).not.toBe("Hacked");
  });

  test("anonymous role has no access to app tables", async () => {
    const anon = anonClient();
    for (const table of ["students", "student_plans", "practice_sessions"]) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      // Either a permission error or zero rows is acceptable; data must not leak.
      if (error) continue;
      expect(data, `${table}: anon read leaked rows`).toEqual([]);
    }
  });
});
