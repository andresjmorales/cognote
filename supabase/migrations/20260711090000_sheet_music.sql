-- Phase 5A: private teacher sheet-music library + per-student assignments.
-- See .ai/SHEET_MUSIC.md § Phase 5A.

CREATE TABLE music_library_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  title           text NOT NULL,
  composer        text NOT NULL DEFAULT '',
  arranger        text NOT NULL DEFAULT '',
  format          text NOT NULL
    CHECK (format IN ('pdf', 'musicxml', 'mxl')),
  original_filename text NOT NULL,
  storage_path    text NOT NULL,
  mime_type       text NOT NULL,
  byte_size       int NOT NULL CHECK (byte_size > 0),
  sha256          text NOT NULL,
  tags            text[] NOT NULL DEFAULT '{}',
  source          text NOT NULL DEFAULT 'teacher_upload',
  source_url      text,
  license_code    text NOT NULL DEFAULT 'teacher_owned'
    CHECK (license_code IN (
      'public_domain', 'cc0', 'cc_by', 'cc_by_sa',
      'teacher_owned', 'unknown', 'restricted'
    )),
  license_url     text,
  attribution     text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, storage_path),
  UNIQUE (teacher_id, sha256)
);

CREATE INDEX music_library_items_teacher_idx
  ON music_library_items (teacher_id, created_at DESC);

CREATE INDEX music_library_items_title_idx
  ON music_library_items (teacher_id, lower(title));

CREATE TABLE sheet_music_assignments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  music_item_id    uuid NOT NULL REFERENCES music_library_items(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assignment_note  text NOT NULL DEFAULT '',
  due_date         date,
  assigned_at      timestamptz NOT NULL DEFAULT now(),
  unassigned_at    timestamptz,
  emailed_at       timestamptz
);

-- Historical assignments allowed; only one active row per item+student.
CREATE UNIQUE INDEX sheet_music_assignments_one_active
  ON sheet_music_assignments (music_item_id, student_id)
  WHERE unassigned_at IS NULL;

CREATE INDEX sheet_music_assignments_student_idx
  ON sheet_music_assignments (student_id, assigned_at DESC);

ALTER TABLE music_library_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_music_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY music_library_items_teacher ON music_library_items
  FOR ALL USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY sheet_music_assignments_teacher ON sheet_music_assignments
  FOR ALL USING (
    music_item_id IN (
      SELECT id FROM music_library_items WHERE teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    music_item_id IN (
      SELECT id FROM music_library_items WHERE teacher_id = auth.uid()
    )
    AND student_id IN (
      SELECT id FROM students WHERE teacher_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  music_library_items,
  sheet_music_assignments
TO anon, authenticated, service_role;

-- Private storage bucket for score files.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sheet-music',
  'sheet-music',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/xml',
    'text/xml',
    'application/vnd.recordare.musicxml+xml',
    'application/vnd.recordare.musicxml',
    'application/zip',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Object keys: <teacher-id>/<library-item-id>/<sanitized-name>
CREATE POLICY sheet_music_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'sheet-music'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY sheet_music_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sheet-music'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY sheet_music_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'sheet-music'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'sheet-music'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY sheet_music_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'sheet-music'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
