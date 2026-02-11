-- ═══════════════════════════════════════════
-- Migration 00029: Table formateur_disponibilites
-- Référencée dans src/actions/disponibilites.ts
-- ═══════════════════════════════════════════

CREATE TABLE formateur_disponibilites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  formateur_id uuid NOT NULL REFERENCES formateurs(id) ON DELETE CASCADE,
  date date NOT NULL,
  heure_debut time,
  heure_fin time,
  type text NOT NULL DEFAULT 'disponible'
    CHECK (type IN ('disponible', 'indisponible', 'sous_reserve')),
  recurrence text DEFAULT 'aucune'
    CHECK (recurrence IS NULL OR recurrence IN ('aucune', 'hebdomadaire', 'mensuelle')),
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_formateur_dispo_org_formateur_date
  ON formateur_disponibilites(organisation_id, formateur_id, date);
CREATE INDEX idx_formateur_dispo_formateur
  ON formateur_disponibilites(formateur_id);

-- Updated_at trigger
CREATE TRIGGER update_formateur_disponibilites_updated_at
  BEFORE UPDATE ON formateur_disponibilites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS ────────────────────────────────────────────────
ALTER TABLE formateur_disponibilites ENABLE ROW LEVEL SECURITY;

-- Policy: access by organisation_id matching the user's org
CREATE POLICY "Users access own org disponibilites" ON formateur_disponibilites
  FOR ALL USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  );

-- Service role bypass (for admin client / extranet context)
CREATE POLICY "Service role full access" ON formateur_disponibilites
  FOR ALL USING (auth.role() = 'service_role');
