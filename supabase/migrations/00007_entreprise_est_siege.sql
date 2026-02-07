-- Add est_siege column to entreprises table
-- Allows marking an enterprise as "siège social" (headquarters)
ALTER TABLE entreprises
ADD COLUMN IF NOT EXISTS est_siege boolean DEFAULT false;
