-- Per-studio lesson label for the calendar feeds.
--
-- The .ics feeds titled every lesson "Piano lesson — <student>" and named the
-- calendar "Piano Lessons", which is wrong for any studio that does not teach
-- piano. A teacher can now name their subject (e.g. "Piano", "Violin"); the
-- feed reads "<label> lesson — <student>". An empty label keeps the neutral
-- "Lesson" wording, and the calendar itself follows studio_name when set.
--
-- studio_policies already carries a table-level grant to authenticated, so a
-- new column needs no extra GRANT here (unlike public.teachers, whose grants
-- are column-scoped).

ALTER TABLE public.studio_policies
  ADD COLUMN lesson_label text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.studio_policies.lesson_label IS
  'Subject/instrument used in calendar feed titles (e.g. "Piano" -> "Piano lesson — Ann"). Empty = neutral "Lesson".';
