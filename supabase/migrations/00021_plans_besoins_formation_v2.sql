-- ═══════════════════════════════════════════
-- Migration 00021: Plans de formation + Évolution besoins de formation
-- - Table plans_formation (plan annuel par entreprise, avec budget)
-- - Nouvelles colonnes sur besoins_formation :
--   * type_besoin (plan / ponctuel)
--   * produit_id (lien programme de formation)
--   * plan_formation_id (rattachement au plan annuel)
--   * cout_estime (coût du besoin)
--   * intitule_personnalise (renommage libre)
-- ═══════════════════════════════════════════

-- ═══════════════════════════════════════════
-- 1. TABLE PLANS DE FORMATION
-- ═══════════════════════════════════════════

CREATE TABLE plans_formation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  annee int NOT NULL,
  nom text,                          -- Ex: "Plan de formation 2026"
  budget_total numeric(10,2) DEFAULT 0,  -- Budget alloué pour l'année
  notes text,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (organisation_id, entreprise_id, annee)
);

CREATE INDEX idx_plans_formation_organisation ON plans_formation(organisation_id);
CREATE INDEX idx_plans_formation_entreprise ON plans_formation(entreprise_id);
CREATE INDEX idx_plans_formation_annee ON plans_formation(annee);

-- RLS
ALTER TABLE plans_formation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_formation_select" ON plans_formation FOR SELECT
  USING (organisation_id = auth_organisation_id());
CREATE POLICY "plans_formation_insert" ON plans_formation FOR INSERT
  WITH CHECK (organisation_id = auth_organisation_id());
CREATE POLICY "plans_formation_update" ON plans_formation FOR UPDATE
  USING (organisation_id = auth_organisation_id());
CREATE POLICY "plans_formation_delete" ON plans_formation FOR DELETE
  USING (organisation_id = auth_organisation_id());

-- Trigger updated_at
CREATE TRIGGER set_plans_formation_updated_at
  BEFORE UPDATE ON plans_formation
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════
-- 2. ÉVOLUTION TABLE BESOINS_FORMATION
-- ═══════════════════════════════════════════

-- 2a. Type de besoin : plan ou ponctuel
ALTER TABLE besoins_formation
  ADD COLUMN type_besoin text DEFAULT 'ponctuel' NOT NULL
    CHECK (type_besoin IN ('plan', 'ponctuel'));

-- 2b. Lien vers le programme de formation (produit)
ALTER TABLE besoins_formation
  ADD COLUMN produit_id uuid REFERENCES produits_formation(id) ON DELETE SET NULL;

-- 2c. Rattachement au plan annuel (null si ponctuel)
ALTER TABLE besoins_formation
  ADD COLUMN plan_formation_id uuid REFERENCES plans_formation(id) ON DELETE SET NULL;

-- 2d. Coût estimé du besoin
ALTER TABLE besoins_formation
  ADD COLUMN cout_estime numeric(10,2) DEFAULT 0;

-- 2e. Intitulé personnalisé (renommage libre, indépendant du programme)
-- L'intitulé existant reste le champ principal affiché.
-- intitule_original stocke l'intitulé initial quand lié à un programme
ALTER TABLE besoins_formation
  ADD COLUMN intitule_original text;

-- 2f. Mettre à jour la contrainte de statut pour ajouter "transforme"
ALTER TABLE besoins_formation DROP CONSTRAINT IF EXISTS besoins_formation_statut_check;
ALTER TABLE besoins_formation ADD CONSTRAINT besoins_formation_statut_check
  CHECK (statut IN ('a_etudier', 'valide', 'planifie', 'realise', 'transforme'));

-- Index supplémentaires
CREATE INDEX idx_besoins_formation_type ON besoins_formation(type_besoin);
CREATE INDEX idx_besoins_formation_produit ON besoins_formation(produit_id);
CREATE INDEX idx_besoins_formation_plan ON besoins_formation(plan_formation_id);

-- ═══════════════════════════════════════════
-- 3. MISE À JOUR DES DONNÉES EXISTANTES
-- Tous les besoins existants sont "ponctuel" par défaut (déjà fait via DEFAULT)
-- ═══════════════════════════════════════════
