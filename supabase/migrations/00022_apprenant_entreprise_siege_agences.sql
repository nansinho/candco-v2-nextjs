-- Migration: Add headquarters/agency attachment to apprenant-entreprise relationship
-- Allows learners to be linked to specific headquarters (siège) and/or agencies of an enterprise

-- 1. Add est_siege flag to apprenant_entreprises
ALTER TABLE apprenant_entreprises
  ADD COLUMN IF NOT EXISTS est_siege boolean NOT NULL DEFAULT true;

-- 2. Create junction table for apprenant-entreprise-agence relationships
CREATE TABLE IF NOT EXISTS apprenant_entreprise_agences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apprenant_entreprise_id uuid NOT NULL REFERENCES apprenant_entreprises(id) ON DELETE CASCADE,
  agence_id uuid NOT NULL REFERENCES entreprise_agences(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (apprenant_entreprise_id, agence_id)
);

-- 3. RLS for apprenant_entreprise_agences
ALTER TABLE apprenant_entreprise_agences ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (access controlled through parent tables)
CREATE POLICY "apprenant_entreprise_agences_select"
  ON apprenant_entreprise_agences FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "apprenant_entreprise_agences_insert"
  ON apprenant_entreprise_agences FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "apprenant_entreprise_agences_delete"
  ON apprenant_entreprise_agences FOR DELETE TO authenticated
  USING (true);

-- 4. Index for performance
CREATE INDEX IF NOT EXISTS idx_apprenant_entreprise_agences_ae_id
  ON apprenant_entreprise_agences(apprenant_entreprise_id);

CREATE INDEX IF NOT EXISTS idx_apprenant_entreprise_agences_agence_id
  ON apprenant_entreprise_agences(agence_id);
