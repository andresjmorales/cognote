-- Add show_hints option for symbol/concept plans
-- When false, definition text is hidden during quizzes, requiring visual-only identification
ALTER TABLE plans ADD COLUMN show_hints boolean NOT NULL DEFAULT true;
