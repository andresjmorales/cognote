-- Add key_signature_identification plan type and supporting columns

-- Allow new plan type
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_plan_type_check;
ALTER TABLE plans ADD CONSTRAINT plans_plan_type_check
  CHECK (plan_type IN ('note_identification', 'symbol_concepts', 'key_signature_identification'));

-- Key-sig ID: scale mode (major only, minor only, or both)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS key_sig_scale_mode text NOT NULL DEFAULT 'major'
  CHECK (key_sig_scale_mode IN ('major', 'minor', 'both'));

-- Key-sig ID: selected key signature names to quiz (e.g. ["C major", "G major", "A major"])
ALTER TABLE plans ADD COLUMN IF NOT EXISTS key_signatures jsonb NOT NULL DEFAULT '[]'::jsonb;
