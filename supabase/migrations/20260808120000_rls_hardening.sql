-- Security hardening for multi-teacher hosted deployments.
--
-- 1. Practice tables: drop the permissive policies that let the anon role
--    read every practice token and write arbitrary practice data. Student and
--    parent traffic never queries the Data API directly; it goes through
--    token-checked API routes that use the service role.
-- 2. Replace teacher SELECT-only policies on practice tables with full
--    ownership-chain policies so the authenticated studio import
--    (Account -> Import data) keeps working without the permissive rules.
-- 3. teachers: column-level UPDATE grants so a signed-in teacher cannot
--    change their own hosted entitlement columns (hosted_plan,
--    trial_ends_at, gifted_until, stripe_*, founding_number).
-- 4. Revoke all anon grants on app tables (defense in depth; anon-key
--    clients have no legitimate direct table access).

-- ---------------------------------------------------------------------------
-- 1. Drop permissive practice policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS student_plans_token_read ON public.student_plans;
DROP POLICY IF EXISTS sessions_anon_insert ON public.practice_sessions;
DROP POLICY IF EXISTS sessions_anon_update ON public.practice_sessions;
DROP POLICY IF EXISTS attempts_anon_insert ON public.note_attempts;
DROP POLICY IF EXISTS flashcard_anon ON public.flashcard_progress;

-- ---------------------------------------------------------------------------
-- 2. Teacher ownership-chain policies for practice data (read + write)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS sessions_teacher ON public.practice_sessions;
CREATE POLICY sessions_teacher ON public.practice_sessions
  FOR ALL TO authenticated
  USING (
    student_plan_id IN (
      SELECT sp.id FROM public.student_plans sp
      JOIN public.students s ON s.id = sp.student_id
      WHERE s.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS attempts_teacher ON public.note_attempts;
CREATE POLICY attempts_teacher ON public.note_attempts
  FOR ALL TO authenticated
  USING (
    session_id IN (
      SELECT ps.id FROM public.practice_sessions ps
      JOIN public.student_plans sp ON sp.id = ps.student_plan_id
      JOIN public.students s ON s.id = sp.student_id
      WHERE s.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS flashcard_teacher ON public.flashcard_progress;
CREATE POLICY flashcard_teacher ON public.flashcard_progress
  FOR ALL TO authenticated
  USING (
    student_plan_id IN (
      SELECT sp.id FROM public.student_plans sp
      JOIN public.students s ON s.id = sp.student_id
      WHERE s.teacher_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Lock teacher entitlement columns
-- ---------------------------------------------------------------------------
-- Teachers may update only their profile columns through the Data API.
-- Entitlement and platform-billing columns are written exclusively by the
-- service role (hosted billing webhook / checkout / admin scripts).

REVOKE INSERT, UPDATE, DELETE ON public.teachers FROM authenticated;
GRANT UPDATE (email, display_name, avatar_url) ON public.teachers TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Revoke anon access to all app tables
-- ---------------------------------------------------------------------------

REVOKE ALL ON
  public.teachers,
  public.students,
  public.plans,
  public.student_plans,
  public.practice_sessions,
  public.note_attempts,
  public.flashcard_progress,
  public.guardians,
  public.studio_policies,
  public.lesson_slots,
  public.lessons,
  public.attendance,
  public.lesson_notes,
  public.waitlist,
  public.skill_dimensions,
  public.skill_assessments,
  public.invoices,
  public.invoice_items,
  public.payments,
  public.notifications,
  public.music_library_items,
  public.sheet_music_assignments,
  public.events,
  public.event_students,
  public.event_rsvps
FROM anon;
