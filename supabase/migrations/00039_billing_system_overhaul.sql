-- ═══════════════════════════════════════════
-- Migration 00039 : Refonte systeme facturation OF
-- - Lien devis/factures/avoirs -> commanditaire
-- - Types de facture (acompte/solde)
-- - Subrogation sur commanditaires
-- - Suivi convention enrichi
-- - Normalisation statut Documenso
-- ═══════════════════════════════════════════

-- ─── A1. Lier devis/factures/avoirs a un commanditaire ─────────

ALTER TABLE devis
  ADD COLUMN IF NOT EXISTS commanditaire_id uuid REFERENCES session_commanditaires(id) ON DELETE SET NULL;

ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS commanditaire_id uuid REFERENCES session_commanditaires(id) ON DELETE SET NULL;

ALTER TABLE avoirs
  ADD COLUMN IF NOT EXISTS commanditaire_id uuid REFERENCES session_commanditaires(id) ON DELETE SET NULL;

-- ─── A2. Types de facture (acompte/solde) ──────────────────────

ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS type_facture text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS facture_parent_id uuid REFERENCES factures(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pourcentage_acompte numeric(5,2);

-- Check constraint pour type_facture
DO $$ BEGIN
  ALTER TABLE factures ADD CONSTRAINT factures_type_facture_check
    CHECK (type_facture IN ('standard', 'acompte', 'solde'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── A3. Subrogation sur session_commanditaires ────────────────

ALTER TABLE session_commanditaires
  ADD COLUMN IF NOT EXISTS subrogation_mode text DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS montant_entreprise numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS montant_financeur numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS facturer_entreprise boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS facturer_financeur boolean DEFAULT false;

-- Check constraint pour subrogation_mode
DO $$ BEGIN
  ALTER TABLE session_commanditaires ADD CONSTRAINT commanditaires_subrogation_mode_check
    CHECK (subrogation_mode IN ('direct', 'subrogation_partielle', 'subrogation_totale'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── A4. Suivi convention enrichi ──────────────────────────────

ALTER TABLE session_commanditaires
  ADD COLUMN IF NOT EXISTS convention_statut text DEFAULT 'aucune',
  ADD COLUMN IF NOT EXISTS convention_pdf_url text,
  ADD COLUMN IF NOT EXISTS convention_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS convention_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS convention_signed_at timestamptz;

-- Check constraint pour convention_statut
DO $$ BEGIN
  ALTER TABLE session_commanditaires ADD CONSTRAINT commanditaires_convention_statut_check
    CHECK (convention_statut IN ('aucune', 'brouillon', 'generee', 'envoyee', 'signee', 'refusee'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill depuis les donnees existantes
UPDATE session_commanditaires SET convention_statut = CASE
  WHEN convention_signee = true THEN 'signee'
  WHEN convention_url IS NOT NULL THEN 'generee'
  ELSE 'aucune'
END
WHERE convention_statut = 'aucune' OR convention_statut IS NULL;

-- ─── A5. Normalisation statut Documenso ────────────────────────

-- signature_requests utilisait "completed" au lieu de "signed" pour coherence
UPDATE signature_requests SET documenso_status = 'signed' WHERE documenso_status = 'completed';

-- ─── A6. Index ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_devis_commanditaire
  ON devis(commanditaire_id) WHERE commanditaire_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_factures_commanditaire
  ON factures(commanditaire_id) WHERE commanditaire_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_avoirs_commanditaire
  ON avoirs(commanditaire_id) WHERE commanditaire_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_factures_parent
  ON factures(facture_parent_id) WHERE facture_parent_id IS NOT NULL;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
