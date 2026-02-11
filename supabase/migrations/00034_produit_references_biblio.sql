-- ═══════════════════════════════════════════
-- C&CO Formation v2 — Produits: Références Bibliographiques APA 7
-- Table: produit_references_biblio
-- Stockage structuré des références avec champs APA 7e édition
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS produit_references_biblio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES produits_formation(id) ON DELETE CASCADE,

  -- Type de référence (détermine les règles de formatage APA)
  -- Valeurs : livre, article_revue, chapitre_livre, rapport, site_web, these, conference
  type_reference text NOT NULL DEFAULT 'livre',

  -- Auteur(s) : texte libre (ex: "Dupont, J., Martin, A. B., & Bernard, C.")
  auteurs text,

  -- Si true, auteurs est un nom d'organisation (pas d'inversion nom/initiales)
  auteur_institutionnel boolean DEFAULT false,

  -- Année de publication (texte pour gérer "s.d.", "sous presse", "2020-2023")
  annee text,

  -- Titre principal (livre, article, rapport, page web, thèse, communication)
  titre text NOT NULL,

  -- Pour chapitres : titre de l'ouvrage contenant le chapitre
  titre_ouvrage_parent text,

  -- Directeurs de l'ouvrage parent (pour chapitres) : "Bernard, C. (Éd.)"
  editeurs text,

  -- Nom de la revue (pour articles de revue)
  titre_revue text,

  -- Maison d'édition (pour livres, rapports)
  editeur text,

  -- Numéro de volume (pour revues, ouvrages multi-volumes)
  volume text,

  -- Numéro du fascicule (pour revues)
  numero text,

  -- Pages (ex: "123-145", "pp. 45-67")
  pages text,

  -- Édition (ex: "2e éd.", "3rd ed.")
  edition text,

  -- DOI (sans le préfixe https://doi.org/ — le formateur l'ajoute)
  doi text,

  -- URL complète (utilisée si pas de DOI)
  url text,

  -- Date de consultation (pour sites web / ressources en ligne sans DOI stable)
  date_consultation date,

  -- Ordre d'affichage (le tri alphabétique APA est fait côté app)
  ordre int DEFAULT 0,

  -- Notes (optionnel, pas inclus dans la citation APA)
  notes text,

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Index pour lookups FK rapides
CREATE INDEX IF NOT EXISTS idx_produit_references_biblio_produit
  ON produit_references_biblio(produit_id);

-- Index pour tri par ordre
CREATE INDEX IF NOT EXISTS idx_produit_references_biblio_ordre
  ON produit_references_biblio(produit_id, ordre);

-- ═══════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════

ALTER TABLE produit_references_biblio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access through produit" ON produit_references_biblio
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM produits_formation
      WHERE id = produit_id
      AND organisation_id = auth_organisation_id()
    )
  );

-- ═══════════════════════════════════════════
-- Trigger updated_at
-- ═══════════════════════════════════════════

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON produit_references_biblio
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
