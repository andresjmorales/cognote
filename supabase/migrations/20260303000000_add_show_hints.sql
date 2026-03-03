-- Add show_hints option for symbol/concept quizzes.
-- When false, definition hints are hidden during quiz (symbol-only display).
ALTER TABLE plans ADD COLUMN show_hints boolean NOT NULL DEFAULT true;
