-- Migration 00048: Organisation theme presets
-- Adds dark and light theme preset IDs per organisation

ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS theme_dark_preset text NOT NULL DEFAULT 'cursor';

ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS theme_light_preset text NOT NULL DEFAULT 'clean';

COMMENT ON COLUMN organisations.theme_dark_preset IS 'Theme preset ID for dark mode (cursor, midnight, forest)';
COMMENT ON COLUMN organisations.theme_light_preset IS 'Theme preset ID for light mode (clean, ocean, warm)';
