-- ═══════════════════════════════════════════
-- C&CO Formation v2 — Catalogue Categories
-- Hierarchical categories: Pôle → Catégorie → Sous-catégorie
-- ═══════════════════════════════════════════

-- ─── Lookup table for hierarchical categories ───────────────
CREATE TABLE IF NOT EXISTS catalogue_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES catalogue_categories(id) ON DELETE CASCADE,
  nom text NOT NULL,
  code text,                         -- Optional code (e.g., SAN, SAN-01, SAN-01C)
  niveau int NOT NULL DEFAULT 1,     -- 1 = Pôle, 2 = Catégorie, 3 = Sous-catégorie
  ordre int DEFAULT 0,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_niveau CHECK (niveau BETWEEN 1 AND 3)
);

CREATE INDEX IF NOT EXISTS idx_catalogue_categories_org ON catalogue_categories(organisation_id);
CREATE INDEX IF NOT EXISTS idx_catalogue_categories_parent ON catalogue_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_catalogue_categories_niveau ON catalogue_categories(organisation_id, niveau);

-- ─── Add sous_categorie_id on produits_formation ───────────────
ALTER TABLE produits_formation ADD COLUMN IF NOT EXISTS sous_categorie_id uuid REFERENCES catalogue_categories(id) ON DELETE SET NULL;
-- Also add category reference columns (keeping existing text fields intact for backward compat)
ALTER TABLE produits_formation ADD COLUMN IF NOT EXISTS domaine_categorie_id uuid REFERENCES catalogue_categories(id) ON DELETE SET NULL;
ALTER TABLE produits_formation ADD COLUMN IF NOT EXISTS categorie_id uuid REFERENCES catalogue_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_produits_domaine_cat ON produits_formation(domaine_categorie_id);
CREATE INDEX IF NOT EXISTS idx_produits_categorie ON produits_formation(categorie_id);
CREATE INDEX IF NOT EXISTS idx_produits_sous_categorie ON produits_formation(sous_categorie_id);

-- ─── RLS ───────────────────────────────────────────────────
ALTER TABLE catalogue_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org isolation" ON catalogue_categories
  FOR ALL USING (organisation_id = auth_organisation_id());

-- ─── Trigger updated_at ────────────────────────────────────
CREATE TRIGGER set_updated_at BEFORE UPDATE ON catalogue_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
