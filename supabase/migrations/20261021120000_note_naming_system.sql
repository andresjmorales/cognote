-- Per-studio note-value vocabulary: 'us' (whole/half/quarter note) or 'uk'
-- (semibreve/minim/crotchet). Studio-wide, because a student's practice quiz has
-- to ask in the words their teacher uses.
--
-- Apply BEFORE deploying code that writes it: the settings form saves this
-- column, and an unmigrated database rejects the whole policy upsert, not just
-- this field. Reads are safe either way — getPolicy() spreads DEFAULT_POLICY
-- under the row.
-- studio_policies keeps table-level grants, so no extra GRANT is needed here.

ALTER TABLE public.studio_policies
  ADD COLUMN note_naming_system text NOT NULL DEFAULT 'us'
    CHECK (note_naming_system IN ('us', 'uk'));

COMMENT ON COLUMN public.studio_policies.note_naming_system IS
  'Note-value vocabulary for symbols, quizzes, and flashcards: "us" (whole/half/quarter note) or "uk" (semibreve/minim/crotchet).';
