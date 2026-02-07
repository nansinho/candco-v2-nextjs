-- Migration 00011: Multi-agences par membre + fix migrations manquantes

-- ═══════════════════════════════════════════
-- 1. Fix: fonctions_predefinies (si pas encore créée)
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fonctions_predefinies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  nom text NOT NULL,
  ordre int DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (organisation_id, nom)
);

CREATE INDEX IF NOT EXISTS idx_fonctions_predefinies_org ON fonctions_predefinies(organisation_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fonctions_predefinies' AND policyname = 'Access own org fonctions') THEN
    ALTER TABLE fonctions_predefinies ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Access own org fonctions" ON fonctions_predefinies
      FOR ALL USING (
        organisation_id = (
          SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- Seed defaults
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

-- ═══════════════════════════════════════════
-- 2. Fix: est_siege sur entreprises (si pas encore ajouté)
-- ═══════════════════════════════════════════

ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS est_siege boolean DEFAULT false;

-- ═══════════════════════════════════════════
-- 3. Table membre_agences (many-to-many)
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS membre_agences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id uuid NOT NULL REFERENCES entreprise_membres(id) ON DELETE CASCADE,
  agence_id uuid NOT NULL REFERENCES entreprise_agences(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (membre_id, agence_id)
);

CREATE INDEX IF NOT EXISTS idx_membre_agences_membre ON membre_agences(membre_id);
CREATE INDEX IF NOT EXISTS idx_membre_agences_agence ON membre_agences(agence_id);

-- RLS: access through parent entreprise_membres
ALTER TABLE membre_agences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access through membre" ON membre_agences
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM entreprise_membres em
      JOIN entreprises e ON e.id = em.entreprise_id
      WHERE em.id = membre_id
      AND e.organisation_id = (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

-- ═══════════════════════════════════════════
-- 4. Migrate existing agence_id data to membre_agences
-- ═══════════════════════════════════════════

INSERT INTO membre_agences (membre_id, agence_id)
SELECT id, agence_id
FROM entreprise_membres
WHERE agence_id IS NOT NULL
ON CONFLICT DO NOTHING;
