-- ═══════════════════════════════════════════
-- MIGRATION 00005 — Fonctions prédéfinies
-- ═══════════════════════════════════════════

-- Table des fonctions/postes prédéfinis par organisation
CREATE TABLE fonctions_predefinies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  nom text NOT NULL,
  ordre int DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (organisation_id, nom)
);

CREATE INDEX idx_fonctions_predefinies_org ON fonctions_predefinies(organisation_id);

-- RLS
ALTER TABLE fonctions_predefinies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access own org fonctions" ON fonctions_predefinies
  FOR ALL USING (
    organisation_id = (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  );

-- Seed des fonctions par défaut pour les organisations existantes
-- (sera aussi appelé lors de la création d'une nouvelle organisation)
INSERT INTO fonctions_predefinies (organisation_id, nom, ordre)
SELECT o.id, f.nom, f.ordre
FROM organisations o
CROSS JOIN (VALUES
  ('Directeur Général', 1),
  ('Directeur d''agence', 2),
  ('Responsable formation', 3),
  ('Responsable', 4),
  ('Manager', 5),
  ('Chef d''équipe', 6),
  ('Responsable QSE', 7),
  ('HSE', 8),
  ('Comptabilité', 9),
  ('Assistant(e) de direction', 10),
  ('DRH', 11),
  ('Responsable RH', 12),
  ('Chef de projet', 13),
  ('Technicien', 14),
  ('Opérateur', 15)
) AS f(nom, ordre)
ON CONFLICT DO NOTHING;
