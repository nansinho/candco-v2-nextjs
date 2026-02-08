-- ═══════════════════════════════════════════
-- C&CO Formation v2 — Produits: Bibliographie
-- Tables: produit_ouvrages, produit_articles
-- Pour les formations (sante notamment) qui
-- referent des ouvrages et articles scientifiques
-- ═══════════════════════════════════════════

-- ═══════════════════════════════════════════
-- OUVRAGES ET TRAITES DE REFERENCE
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS produit_ouvrages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES produits_formation(id) ON DELETE CASCADE,
  auteurs text,
  titre text NOT NULL,
  annee text,
  source_editeur text,
  ordre int DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_produit_ouvrages_produit ON produit_ouvrages(produit_id);

-- ═══════════════════════════════════════════
-- ARTICLES SCIENTIFIQUES
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS produit_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES produits_formation(id) ON DELETE CASCADE,
  auteurs text,
  titre text NOT NULL,
  source_revue text,
  annee text,
  doi text,
  ordre int DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_produit_articles_produit ON produit_articles(produit_id);

-- ═══════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════

ALTER TABLE produit_ouvrages ENABLE ROW LEVEL SECURITY;
ALTER TABLE produit_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access through produit" ON produit_ouvrages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM produits_formation WHERE id = produit_id AND organisation_id = auth_organisation_id())
  );

CREATE POLICY "Access through produit" ON produit_articles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM produits_formation WHERE id = produit_id AND organisation_id = auth_organisation_id())
  );
