-- ═══════════════════════════════════════════
-- C&CO Formation v2 — Phase 2: Produits de formation
-- Tables: produits_formation, produit_tarifs, produit_objectifs,
--         produit_programme, produit_documents
-- ═══════════════════════════════════════════

-- ═══════════════════════════════════════════
-- PRODUITS DE FORMATION (catalogue)
-- ═══════════════════════════════════════════

CREATE TABLE produits_formation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  numero_affichage text,                -- PROD-0025
  intitule text NOT NULL,
  sous_titre text,
  description text,                     -- Rich text (HTML)
  identifiant_interne text,
  -- Classification
  domaine text,                         -- Pôle / domaine
  type_action text CHECK (type_action IN ('action_formation', 'bilan_competences', 'vae', 'apprentissage')),
  modalite text CHECK (modalite IN ('presentiel', 'distanciel', 'mixte', 'afest')),
  formule text CHECK (formule IN ('inter', 'intra', 'individuel')),
  -- Durée
  duree_heures numeric(8,2),
  duree_jours numeric(8,2),
  -- BPF
  bpf_specialite_id uuid REFERENCES bpf_specialites(id),
  bpf_categorie text CHECK (bpf_categorie IN ('A', 'B', 'C')),
  bpf_niveau text CHECK (bpf_niveau IN ('I', 'II', 'III', 'IV', 'V')),
  -- Catalogue en ligne
  publie boolean DEFAULT false,
  populaire boolean DEFAULT false,
  slug text,
  image_url text,
  -- Complétion
  completion_pct int DEFAULT 0,
  -- Méta
  archived_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_produits_formation_org ON produits_formation(organisation_id);
CREATE INDEX idx_produits_formation_slug ON produits_formation(slug) WHERE slug IS NOT NULL;

-- ═══════════════════════════════════════════
-- TARIFS (multi-tarifs par produit)
-- ═══════════════════════════════════════════

CREATE TABLE produit_tarifs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES produits_formation(id) ON DELETE CASCADE,
  nom text,                             -- Ex: "Tarif standard", "Tarif OPCO"
  prix_ht numeric(10,2),
  taux_tva numeric(5,2) DEFAULT 0,
  unite text CHECK (unite IN ('stagiaire', 'groupe', 'jour', 'heure', 'forfait')),
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_produit_tarifs_produit ON produit_tarifs(produit_id);

-- ═══════════════════════════════════════════
-- OBJECTIFS PÉDAGOGIQUES
-- ═══════════════════════════════════════════

CREATE TABLE produit_objectifs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES produits_formation(id) ON DELETE CASCADE,
  objectif text NOT NULL,
  ordre int DEFAULT 0
);

CREATE INDEX idx_produit_objectifs_produit ON produit_objectifs(produit_id);

-- ═══════════════════════════════════════════
-- PROGRAMME (modules / sections)
-- ═══════════════════════════════════════════

CREATE TABLE produit_programme (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES produits_formation(id) ON DELETE CASCADE,
  titre text NOT NULL,
  contenu text,                         -- HTML rich content
  duree text,
  ordre int DEFAULT 0
);

CREATE INDEX idx_produit_programme_produit ON produit_programme(produit_id);

-- ═══════════════════════════════════════════
-- DOCUMENTS LIÉS AU PRODUIT
-- ═══════════════════════════════════════════

CREATE TABLE produit_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES produits_formation(id) ON DELETE CASCADE,
  nom text NOT NULL,
  categorie text CHECK (categorie IN ('programme', 'plaquette', 'convention', 'attestation', 'autre')),
  fichier_url text,
  genere boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_produit_documents_produit ON produit_documents(produit_id);

-- ═══════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════

ALTER TABLE produits_formation ENABLE ROW LEVEL SECURITY;
ALTER TABLE produit_tarifs ENABLE ROW LEVEL SECURITY;
ALTER TABLE produit_objectifs ENABLE ROW LEVEL SECURITY;
ALTER TABLE produit_programme ENABLE ROW LEVEL SECURITY;
ALTER TABLE produit_documents ENABLE ROW LEVEL SECURITY;

-- Produits: standard org isolation
CREATE POLICY "Org isolation select" ON produits_formation FOR SELECT
  USING (organisation_id = auth_organisation_id());
CREATE POLICY "Org isolation insert" ON produits_formation FOR INSERT
  WITH CHECK (organisation_id = auth_organisation_id());
CREATE POLICY "Org isolation update" ON produits_formation FOR UPDATE
  USING (organisation_id = auth_organisation_id());
CREATE POLICY "Org isolation delete" ON produits_formation FOR DELETE
  USING (organisation_id = auth_organisation_id());

-- Child tables: access through parent produit
CREATE POLICY "Access through produit" ON produit_tarifs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM produits_formation WHERE id = produit_id AND organisation_id = auth_organisation_id())
  );

CREATE POLICY "Access through produit" ON produit_objectifs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM produits_formation WHERE id = produit_id AND organisation_id = auth_organisation_id())
  );

CREATE POLICY "Access through produit" ON produit_programme
  FOR ALL USING (
    EXISTS (SELECT 1 FROM produits_formation WHERE id = produit_id AND organisation_id = auth_organisation_id())
  );

CREATE POLICY "Access through produit" ON produit_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM produits_formation WHERE id = produit_id AND organisation_id = auth_organisation_id())
  );

-- ═══════════════════════════════════════════
-- UPDATED_AT TRIGGERS (for new tables with updated_at)
-- ═══════════════════════════════════════════

CREATE TRIGGER set_updated_at BEFORE UPDATE ON produits_formation
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON produit_tarifs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
