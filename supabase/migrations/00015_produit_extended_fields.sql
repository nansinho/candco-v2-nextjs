-- ═══════════════════════════════════════════
-- C&CO Formation v2 — Produits: champs étendus
-- Ajout des champs manquants pour l'import PDF IA
-- et les nouveaux onglets (Pratique, Modalités, etc.)
-- ═══════════════════════════════════════════

-- ─── Nouveaux champs sur produits_formation ───────────────

-- Infos pratiques
ALTER TABLE produits_formation ADD COLUMN IF NOT EXISTS certification text;
ALTER TABLE produits_formation ADD COLUMN IF NOT EXISTS delai_acces text;
ALTER TABLE produits_formation ADD COLUMN IF NOT EXISTS nombre_participants_min int;
ALTER TABLE produits_formation ADD COLUMN IF NOT EXISTS nombre_participants_max int;
ALTER TABLE produits_formation ADD COLUMN IF NOT EXISTS lieu_format text;

-- Modalités pédagogiques
ALTER TABLE produits_formation ADD COLUMN IF NOT EXISTS modalites_evaluation text;
ALTER TABLE produits_formation ADD COLUMN IF NOT EXISTS modalites_pedagogiques text;
ALTER TABLE produits_formation ADD COLUMN IF NOT EXISTS moyens_pedagogiques text;
ALTER TABLE produits_formation ADD COLUMN IF NOT EXISTS accessibilite text;

-- Paiement
ALTER TABLE produits_formation ADD COLUMN IF NOT EXISTS modalites_paiement text;

-- Équipe
ALTER TABLE produits_formation ADD COLUMN IF NOT EXISTS equipe_pedagogique text;

-- SEO
ALTER TABLE produits_formation ADD COLUMN IF NOT EXISTS meta_titre text;
ALTER TABLE produits_formation ADD COLUMN IF NOT EXISTS meta_description text;

-- Catégorie (en plus du domaine/pôle)
ALTER TABLE produits_formation ADD COLUMN IF NOT EXISTS categorie text;

-- ═══════════════════════════════════════════
-- PRÉREQUIS (liste dynamique)
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS produit_prerequis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES produits_formation(id) ON DELETE CASCADE,
  texte text NOT NULL,
  ordre int DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_produit_prerequis_produit ON produit_prerequis(produit_id);

-- ═══════════════════════════════════════════
-- PUBLIC VISÉ (liste dynamique)
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS produit_public_vise (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES produits_formation(id) ON DELETE CASCADE,
  texte text NOT NULL,
  ordre int DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_produit_public_vise_produit ON produit_public_vise(produit_id);

-- ═══════════════════════════════════════════
-- OPTIONS DE FINANCEMENT (liste dynamique)
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS produit_financement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES produits_formation(id) ON DELETE CASCADE,
  texte text NOT NULL,
  ordre int DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_produit_financement_produit ON produit_financement(produit_id);

-- ═══════════════════════════════════════════
-- COMPÉTENCES VISÉES (liste dynamique)
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS produit_competences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES produits_formation(id) ON DELETE CASCADE,
  texte text NOT NULL,
  ordre int DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_produit_competences_produit ON produit_competences(produit_id);

-- ═══════════════════════════════════════════
-- TEMPLATES D'IMPORT IA (par organisation)
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS import_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  nom text NOT NULL,
  description text,
  -- Indices pour l'IA sur comment mapper les champs
  field_hints jsonb DEFAULT '{}',
  -- Exemple complet d'extraction réussie (few-shot)
  exemple_extraction jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_import_templates_org ON import_templates(organisation_id);

-- ═══════════════════════════════════════════
-- RLS pour les nouvelles tables
-- ═══════════════════════════════════════════

ALTER TABLE produit_prerequis ENABLE ROW LEVEL SECURITY;
ALTER TABLE produit_public_vise ENABLE ROW LEVEL SECURITY;
ALTER TABLE produit_financement ENABLE ROW LEVEL SECURITY;
ALTER TABLE produit_competences ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_templates ENABLE ROW LEVEL SECURITY;

-- Accès via parent produit
CREATE POLICY "Access through produit" ON produit_prerequis
  FOR ALL USING (
    EXISTS (SELECT 1 FROM produits_formation WHERE id = produit_id AND organisation_id = auth_organisation_id())
  );

CREATE POLICY "Access through produit" ON produit_public_vise
  FOR ALL USING (
    EXISTS (SELECT 1 FROM produits_formation WHERE id = produit_id AND organisation_id = auth_organisation_id())
  );

CREATE POLICY "Access through produit" ON produit_financement
  FOR ALL USING (
    EXISTS (SELECT 1 FROM produits_formation WHERE id = produit_id AND organisation_id = auth_organisation_id())
  );

CREATE POLICY "Access through produit" ON produit_competences
  FOR ALL USING (
    EXISTS (SELECT 1 FROM produits_formation WHERE id = produit_id AND organisation_id = auth_organisation_id())
  );

-- Import templates: org isolation
CREATE POLICY "Org isolation" ON import_templates
  FOR ALL USING (organisation_id = auth_organisation_id());

-- Trigger updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON import_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
