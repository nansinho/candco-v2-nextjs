-- =====================================================
-- C&CO Formation v2 — Documents: visible_extranet + formateur categories
-- Create documents table if missing + add extranet visibility toggle
-- =====================================================

-- 1. Create documents table if it doesn't exist yet (from migration 00023)
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  nom text NOT NULL,
  categorie text,
  fichier_url text NOT NULL,
  taille_octets int,
  mime_type text,
  genere boolean DEFAULT false,
  entite_type text NOT NULL,
  entite_id uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organisation_id);
CREATE INDEX IF NOT EXISTS idx_documents_entite ON documents(entite_type, entite_id);

-- 2. RLS (idempotent)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'documents' AND policyname = 'documents_select') THEN
    CREATE POLICY "documents_select" ON documents FOR SELECT
      USING (organisation_id IN (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'documents' AND policyname = 'documents_insert') THEN
    CREATE POLICY "documents_insert" ON documents FOR INSERT
      WITH CHECK (organisation_id IN (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'documents' AND policyname = 'documents_update') THEN
    CREATE POLICY "documents_update" ON documents FOR UPDATE
      USING (organisation_id IN (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'documents' AND policyname = 'documents_delete') THEN
    CREATE POLICY "documents_delete" ON documents FOR DELETE
      USING (organisation_id IN (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      ));
  END IF;
END $$;

-- 3. Add visible_extranet column (defaults to false — documents are private until admin toggles)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS visible_extranet boolean DEFAULT false;

-- 4. Drop old CHECK constraint on categorie and recreate with expanded list
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_categorie_check;

ALTER TABLE documents ADD CONSTRAINT documents_categorie_check CHECK (categorie IN (
  -- Existing categories
  'convention', 'contrat_sous_traitance', 'attestation', 'certificat',
  'programme', 'convocation', 'emargement', 'facture', 'devis',
  -- Formateur-specific categories
  'cv', 'diplome', 'certification', 'piece_identite',
  -- Catch-all
  'autre'
));

-- 5. Index for fast extranet queries (documents WHERE visible_extranet = true)
CREATE INDEX IF NOT EXISTS idx_documents_visible_extranet
  ON documents (entite_type, entite_id)
  WHERE visible_extranet = true;
