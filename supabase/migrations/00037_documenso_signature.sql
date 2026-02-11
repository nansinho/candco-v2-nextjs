-- ═══════════════════════════════════════════
-- Migration 00037 : Documenso signature tracking
-- Ajoute les champs de suivi de signature electronique
-- sur les devis et les documents
-- ═══════════════════════════════════════════

-- Champs signature sur devis
ALTER TABLE devis
  ADD COLUMN IF NOT EXISTS documenso_envelope_id integer,
  ADD COLUMN IF NOT EXISTS documenso_status text DEFAULT NULL
    CHECK (documenso_status IS NULL OR documenso_status IN ('pending', 'signed', 'rejected', 'expired')),
  ADD COLUMN IF NOT EXISTS signed_document_url text,
  ADD COLUMN IF NOT EXISTS signature_sent_at timestamptz;

-- Index pour recherche rapide par envelope_id (webhook)
CREATE INDEX IF NOT EXISTS idx_devis_documenso_envelope_id
  ON devis (documenso_envelope_id) WHERE documenso_envelope_id IS NOT NULL;

-- Table de suivi des signatures (optionnelle, pour conventions aussi)
CREATE TABLE IF NOT EXISTS signature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  -- Document source
  entite_type text NOT NULL,           -- 'devis', 'convention'
  entite_id uuid NOT NULL,
  -- Documenso
  documenso_envelope_id integer,
  documenso_status text DEFAULT 'pending'
    CHECK (documenso_status IN ('pending', 'completed', 'rejected', 'expired')),
  -- Destinataire
  signer_email text NOT NULL,
  signer_name text,
  signing_url text,                    -- URL de signature pour le signataire
  -- Resultat
  signed_at timestamptz,
  signed_document_url text,
  -- PDF source
  source_pdf_url text,
  -- Meta
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE signature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signature_requests_select" ON signature_requests
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
    OR
    organisation_id IN (
      SELECT organisation_id FROM extranet_acces WHERE user_id = auth.uid() AND statut = 'actif'
    )
  );

CREATE POLICY "signature_requests_insert" ON signature_requests
  FOR INSERT WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  );

CREATE POLICY "signature_requests_update" ON signature_requests
  FOR UPDATE USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_signature_requests_org
  ON signature_requests (organisation_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_entite
  ON signature_requests (entite_type, entite_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_envelope
  ON signature_requests (documenso_envelope_id) WHERE documenso_envelope_id IS NOT NULL;
