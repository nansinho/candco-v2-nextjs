-- ═══════════════════════════════════════════════════════════
-- Migration: produit_questionnaires junction table
-- Links questionnaires to produits_formation (catalogue level)
-- Sessions inherit these associations automatically at creation
-- ═══════════════════════════════════════════════════════════

-- Junction table: questionnaires linked to a product
CREATE TABLE IF NOT EXISTS produit_questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES produits_formation(id) ON DELETE CASCADE,
  questionnaire_id uuid NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
  type_usage text NOT NULL CHECK (type_usage IN (
    'positionnement',
    'satisfaction_chaud',
    'satisfaction_client',
    'evaluation_froid',
    'autre'
  )),
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (produit_id, questionnaire_id)
);

-- RLS
ALTER TABLE produit_questionnaires ENABLE ROW LEVEL SECURITY;

-- Policy: users can read produit_questionnaires for products in their organisation
CREATE POLICY "produit_questionnaires_select" ON produit_questionnaires
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM produits_formation pf
      WHERE pf.id = produit_questionnaires.produit_id
        AND pf.organisation_id IN (
          SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
        )
    )
  );

-- Policy: users can insert produit_questionnaires for products in their organisation
CREATE POLICY "produit_questionnaires_insert" ON produit_questionnaires
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM produits_formation pf
      WHERE pf.id = produit_questionnaires.produit_id
        AND pf.organisation_id IN (
          SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
        )
    )
  );

-- Policy: users can update produit_questionnaires for products in their organisation
CREATE POLICY "produit_questionnaires_update" ON produit_questionnaires
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM produits_formation pf
      WHERE pf.id = produit_questionnaires.produit_id
        AND pf.organisation_id IN (
          SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
        )
    )
  );

-- Policy: users can delete produit_questionnaires for products in their organisation
CREATE POLICY "produit_questionnaires_delete" ON produit_questionnaires
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM produits_formation pf
      WHERE pf.id = produit_questionnaires.produit_id
        AND pf.organisation_id IN (
          SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
        )
    )
  );

-- Index for fast lookups
CREATE INDEX idx_produit_questionnaires_produit_id ON produit_questionnaires(produit_id);
CREATE INDEX idx_produit_questionnaires_questionnaire_id ON produit_questionnaires(questionnaire_id);
