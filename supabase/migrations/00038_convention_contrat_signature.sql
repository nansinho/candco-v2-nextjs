-- ═══════════════════════════════════════════
-- Migration 00038 : Signature electronique pour conventions et contrats
-- Ajoute le suivi Documenso sur session_commanditaires
-- ═══════════════════════════════════════════

-- Colonnes signature sur session_commanditaires (conventions)
ALTER TABLE session_commanditaires
  ADD COLUMN IF NOT EXISTS documenso_envelope_id integer,
  ADD COLUMN IF NOT EXISTS documenso_status text DEFAULT NULL
    CHECK (documenso_status IS NULL OR documenso_status IN ('pending', 'signed', 'rejected', 'expired')),
  ADD COLUMN IF NOT EXISTS signature_sent_at timestamptz;

-- Index pour recherche rapide par envelope_id (webhook)
CREATE INDEX IF NOT EXISTS idx_session_commanditaires_documenso
  ON session_commanditaires (documenso_envelope_id) WHERE documenso_envelope_id IS NOT NULL;
