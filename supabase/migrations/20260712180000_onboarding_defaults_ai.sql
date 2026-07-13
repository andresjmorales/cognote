-- Onboarding: default rate basis is per-hour; optional BYO AI keys for assist features.

ALTER TABLE studio_policies
  ALTER COLUMN rate_basis SET DEFAULT 'per_hour';

ALTER TABLE studio_policies
  ADD COLUMN IF NOT EXISTS ai_provider text NOT NULL DEFAULT 'none'
    CHECK (ai_provider IN ('none', 'openai', 'anthropic')),
  ADD COLUMN IF NOT EXISTS ai_api_key text;

COMMENT ON COLUMN studio_policies.ai_provider IS
  'Optional BYO LLM for assist features (import mapping, future drafts). none = off.';
COMMENT ON COLUMN studio_policies.ai_api_key IS
  'Teacher-provided API key for ai_provider. Never logged; masked in API responses.';
