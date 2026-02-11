-- ═══════════════════════════════════════════
-- Migration 00030: Table membre_agences
-- Junction table: entreprise_membres <-> entreprise_agences
-- Référencée dans src/actions/entreprise-organisation.ts et entreprise-emails.ts
-- ═══════════════════════════════════════════

CREATE TABLE membre_agences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id uuid NOT NULL REFERENCES entreprise_membres(id) ON DELETE CASCADE,
  agence_id uuid NOT NULL REFERENCES entreprise_agences(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (membre_id, agence_id)
);

-- Indexes
CREATE INDEX idx_membre_agences_membre ON membre_agences(membre_id);
CREATE INDEX idx_membre_agences_agence ON membre_agences(agence_id);

-- ─── RLS ────────────────────────────────────────────────
ALTER TABLE membre_agences ENABLE ROW LEVEL SECURITY;

-- Policy: access through parent entreprise_agences → entreprises → organisation_id
CREATE POLICY "Access through entreprise" ON membre_agences
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM entreprise_agences ea
      JOIN entreprises e ON ea.entreprise_id = e.id
      WHERE ea.id = membre_agences.agence_id
      AND e.organisation_id IN (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

-- Service role bypass (for admin client / extranet context)
CREATE POLICY "Service role full access" ON membre_agences
  FOR ALL USING (auth.role() = 'service_role');
