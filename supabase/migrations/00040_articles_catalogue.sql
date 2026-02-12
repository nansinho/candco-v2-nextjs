-- ═══════════════════════════════════════════
-- Migration 00040 : Bibliotheque d'articles / prestations
-- Table articles reutilisables pour devis et factures
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS articles_catalogue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  reference text,                          -- Code article optionnel (ex: FORM-001)
  designation text NOT NULL,
  description text,
  prix_unitaire_ht numeric(10,2) NOT NULL DEFAULT 0,
  taux_tva numeric(5,2) NOT NULL DEFAULT 0,
  unite text,                              -- heure, jour, forfait, stagiaire, groupe
  categorie text,                          -- Groupement optionnel
  actif boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_articles_catalogue_org
  ON articles_catalogue(organisation_id);

CREATE INDEX IF NOT EXISTS idx_articles_catalogue_actif
  ON articles_catalogue(organisation_id, actif) WHERE actif = true;

-- ─── Updated_at trigger ──────────────────────────────────
CREATE TRIGGER update_articles_catalogue_updated_at
  BEFORE UPDATE ON articles_catalogue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS ─────────────────────────────────────────────────
ALTER TABLE articles_catalogue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own org articles" ON articles_catalogue
  FOR ALL USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role full access articles" ON articles_catalogue
  FOR ALL USING (auth.role() = 'service_role');

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
