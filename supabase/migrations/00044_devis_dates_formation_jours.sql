-- Migration 00044: Add structured dates array for formation days on devis
-- Keeps dates_formation (text) for display/legacy, adds dates_formation_jours (date[]) for individual date storage
-- Individual dates are exploitable for session creation (time slots), planning, and document generation

ALTER TABLE devis
  ADD COLUMN IF NOT EXISTS dates_formation_jours date[];

COMMENT ON COLUMN devis.dates_formation_jours IS 'Individual formation dates stored as ISO date array for exploitation (session creation, planning)';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
