-- Migration 00010: Champs paramètres organisation + table emails_envoyes

-- ═══════════════════════════════════════════
-- 1. Champs supplémentaires sur organisations
-- ═══════════════════════════════════════════

-- Facturation
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS mentions_legales text;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS conditions_paiement text;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS coordonnees_bancaires text;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS tva_defaut numeric(5,2) DEFAULT 0;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS numero_tva_intracommunautaire text;

-- Email
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS email_expediteur text;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS signature_email text;

-- Couleur
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS couleur_primaire text DEFAULT '#F97316';

-- ═══════════════════════════════════════════
-- 2. Table emails_envoyes (traçabilité)
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS emails_envoyes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  destinataire_email text NOT NULL,
  destinataire_nom text,
  sujet text NOT NULL,
  contenu_html text,
  statut text NOT NULL DEFAULT 'envoye',
  resend_id text,
  entite_type text,
  entite_id uuid,
  template text,
  erreur text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emails_envoyes_org ON emails_envoyes(organisation_id);
CREATE INDEX IF NOT EXISTS idx_emails_envoyes_statut ON emails_envoyes(statut);

-- RLS
ALTER TABLE emails_envoyes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emails_envoyes_select" ON emails_envoyes
  FOR SELECT USING (organisation_id = auth_organisation_id());

CREATE POLICY "emails_envoyes_insert" ON emails_envoyes
  FOR INSERT WITH CHECK (organisation_id = auth_organisation_id());
