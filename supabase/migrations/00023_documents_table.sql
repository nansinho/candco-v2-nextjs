-- ═══════════════════════════════════════════
-- C&CO Formation v2 — Documents (polymorphic)
-- Generic documents table for all entity types
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  nom text NOT NULL,
  categorie text CHECK (categorie IN (
    'convention', 'contrat_sous_traitance', 'attestation', 'certificat',
    'programme', 'convocation', 'emargement', 'facture', 'devis', 'autre'
  )),
  fichier_url text NOT NULL,
  taille_octets int,
  mime_type text,
  genere boolean DEFAULT false,
  -- Polymorphic: links to any entity
  entite_type text NOT NULL,  -- 'session', 'formateur', 'apprenant', 'produit', 'entreprise', etc.
  entite_id uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_documents_org ON documents(organisation_id);
CREATE INDEX idx_documents_entite ON documents(entite_type, entite_id);

-- RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select" ON documents FOR SELECT
  USING (organisation_id IN (
    SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
  ));

CREATE POLICY "documents_insert" ON documents FOR INSERT
  WITH CHECK (organisation_id IN (
    SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
  ));

CREATE POLICY "documents_update" ON documents FOR UPDATE
  USING (organisation_id IN (
    SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
  ));

CREATE POLICY "documents_delete" ON documents FOR DELETE
  USING (organisation_id IN (
    SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
  ));
