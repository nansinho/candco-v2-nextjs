-- Migration 00043: Add 'transforme' status to devis + transforme_le timestamp
-- Allows tracking when a devis has been converted to a training session

-- A. Drop and re-create the CHECK constraint to include 'transforme'
ALTER TABLE devis DROP CONSTRAINT IF EXISTS devis_statut_check;
ALTER TABLE devis ADD CONSTRAINT devis_statut_check
  CHECK (statut IN ('brouillon', 'envoye', 'signe', 'refuse', 'expire', 'transforme'));

-- B. Add timestamp for when the transformation happened (same pattern as envoye_le, signe_le)
ALTER TABLE devis ADD COLUMN IF NOT EXISTS transforme_le timestamptz;

-- C. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
