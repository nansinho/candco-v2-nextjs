-- =====================================================
-- C&CO Formation v2 — Documents: visible_extranet + formateur categories
-- Add extranet visibility toggle + extend document categories
-- =====================================================

-- 1. Add visible_extranet column (defaults to false — documents are private until admin toggles)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS visible_extranet boolean DEFAULT false;

-- 2. Drop old CHECK constraint on categorie and recreate with expanded list
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

-- 3. Index for fast extranet queries (documents WHERE visible_extranet = true)
CREATE INDEX IF NOT EXISTS idx_documents_visible_extranet
  ON documents (entite_type, entite_id)
  WHERE visible_extranet = true;
