-- ═══════════════════════════════════════════════════════════
-- MIGRATION 00028 — Devis, Factures, Avoirs, Opportunités
-- Phase 5 (Commercial) + Phase 6 (Facturation)
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────
-- OPPORTUNITÉS COMMERCIALES
-- ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS opportunites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  nom text NOT NULL,
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE SET NULL,
  contact_client_id uuid REFERENCES contacts_clients(id) ON DELETE SET NULL,
  montant_estime numeric(10,2),
  statut text NOT NULL DEFAULT 'prospect'
    CHECK (statut IN ('prospect', 'qualification', 'proposition', 'negociation', 'gagne', 'perdu')),
  date_cloture_prevue date,
  source text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_opportunites_org ON opportunites(organisation_id);
CREATE INDEX idx_opportunites_statut ON opportunites(statut);
CREATE INDEX idx_opportunites_entreprise ON opportunites(entreprise_id);

-- ───────────────────────────────────────────
-- DEVIS
-- ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS devis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  numero_affichage text,
  -- Destinataire
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE SET NULL,
  contact_client_id uuid REFERENCES contacts_clients(id) ON DELETE SET NULL,
  particulier_nom text,
  particulier_email text,
  particulier_telephone text,
  particulier_adresse text,
  -- Dates
  date_emission date NOT NULL DEFAULT CURRENT_DATE,
  date_echeance date,
  -- Contenu
  objet text,
  conditions text,
  mentions_legales text,
  -- Montants (calculés depuis les lignes)
  total_ht numeric(10,2) DEFAULT 0,
  total_tva numeric(10,2) DEFAULT 0,
  total_ttc numeric(10,2) DEFAULT 0,
  -- Workflow
  statut text NOT NULL DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon', 'envoye', 'signe', 'refuse', 'expire')),
  envoye_le timestamptz,
  signe_le timestamptz,
  -- Relations
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  opportunite_id uuid REFERENCES opportunites(id) ON DELETE SET NULL,
  -- Méta
  archived_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_devis_org ON devis(organisation_id);
CREATE INDEX idx_devis_statut ON devis(statut);
CREATE INDEX idx_devis_entreprise ON devis(entreprise_id);

CREATE TABLE IF NOT EXISTS devis_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id uuid NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
  designation text NOT NULL,
  description text,
  quantite numeric(10,2) DEFAULT 1,
  prix_unitaire_ht numeric(10,2) DEFAULT 0,
  taux_tva numeric(5,2) DEFAULT 0,
  montant_ht numeric(10,2) DEFAULT 0,
  ordre int DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_devis_lignes_devis ON devis_lignes(devis_id);

-- ───────────────────────────────────────────
-- FACTURES
-- ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS factures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  numero_affichage text,
  -- Destinataire
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE SET NULL,
  contact_client_id uuid REFERENCES contacts_clients(id) ON DELETE SET NULL,
  -- Dates
  date_emission date NOT NULL DEFAULT CURRENT_DATE,
  date_echeance date,
  -- Contenu
  objet text,
  conditions_paiement text,
  mentions_legales text,
  -- Montants
  total_ht numeric(10,2) DEFAULT 0,
  total_tva numeric(10,2) DEFAULT 0,
  total_ttc numeric(10,2) DEFAULT 0,
  montant_paye numeric(10,2) DEFAULT 0,
  -- Workflow
  statut text NOT NULL DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon', 'envoyee', 'payee', 'partiellement_payee', 'en_retard')),
  envoye_le timestamptz,
  -- Relations
  devis_id uuid REFERENCES devis(id) ON DELETE SET NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  -- Méta
  archived_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_factures_org ON factures(organisation_id);
CREATE INDEX idx_factures_statut ON factures(statut);
CREATE INDEX idx_factures_entreprise ON factures(entreprise_id);

CREATE TABLE IF NOT EXISTS facture_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  designation text NOT NULL,
  description text,
  quantite numeric(10,2) DEFAULT 1,
  prix_unitaire_ht numeric(10,2) DEFAULT 0,
  taux_tva numeric(5,2) DEFAULT 0,
  montant_ht numeric(10,2) DEFAULT 0,
  ordre int DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_facture_lignes_facture ON facture_lignes(facture_id);

CREATE TABLE IF NOT EXISTS facture_paiements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  date_paiement date NOT NULL,
  montant numeric(10,2) NOT NULL,
  mode text CHECK (mode IN ('virement', 'cheque', 'cb', 'especes', 'prelevement', 'autre')),
  reference text,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_facture_paiements_facture ON facture_paiements(facture_id);

-- ───────────────────────────────────────────
-- AVOIRS
-- ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS avoirs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  numero_affichage text,
  facture_id uuid REFERENCES factures(id) ON DELETE SET NULL,
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE SET NULL,
  date_emission date NOT NULL DEFAULT CURRENT_DATE,
  motif text,
  total_ht numeric(10,2) DEFAULT 0,
  total_tva numeric(10,2) DEFAULT 0,
  total_ttc numeric(10,2) DEFAULT 0,
  statut text NOT NULL DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon', 'emis', 'applique')),
  archived_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_avoirs_org ON avoirs(organisation_id);
CREATE INDEX idx_avoirs_facture ON avoirs(facture_id);

CREATE TABLE IF NOT EXISTS avoir_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avoir_id uuid NOT NULL REFERENCES avoirs(id) ON DELETE CASCADE,
  designation text NOT NULL,
  description text,
  quantite numeric(10,2) DEFAULT 1,
  prix_unitaire_ht numeric(10,2) DEFAULT 0,
  taux_tva numeric(5,2) DEFAULT 0,
  montant_ht numeric(10,2) DEFAULT 0,
  ordre int DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_avoir_lignes_avoir ON avoir_lignes(avoir_id);

-- ───────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ───────────────────────────────────────────

ALTER TABLE opportunites ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE facture_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE facture_paiements ENABLE ROW LEVEL SECURITY;
ALTER TABLE avoirs ENABLE ROW LEVEL SECURITY;
ALTER TABLE avoir_lignes ENABLE ROW LEVEL SECURITY;

-- Org isolation for main tables
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN VALUES
    ('opportunites'), ('devis'), ('factures'), ('avoirs')
  LOOP
    EXECUTE format(
      'CREATE POLICY "Org isolation select" ON %I FOR SELECT USING (organisation_id = auth_organisation_id())',
      t
    );
    EXECUTE format(
      'CREATE POLICY "Org isolation insert" ON %I FOR INSERT WITH CHECK (organisation_id = auth_organisation_id())',
      t
    );
    EXECUTE format(
      'CREATE POLICY "Org isolation update" ON %I FOR UPDATE USING (organisation_id = auth_organisation_id())',
      t
    );
    EXECUTE format(
      'CREATE POLICY "Org isolation delete" ON %I FOR DELETE USING (organisation_id = auth_organisation_id())',
      t
    );
  END LOOP;
END;
$$;

-- Junction/child table policies (access via parent)
CREATE POLICY "Access through devis" ON devis_lignes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM devis WHERE id = devis_id AND organisation_id = auth_organisation_id())
  );

CREATE POLICY "Access through facture" ON facture_lignes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM factures WHERE id = facture_id AND organisation_id = auth_organisation_id())
  );

CREATE POLICY "Access through facture paiement" ON facture_paiements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM factures WHERE id = facture_id AND organisation_id = auth_organisation_id())
  );

CREATE POLICY "Access through avoir" ON avoir_lignes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM avoirs WHERE id = avoir_id AND organisation_id = auth_organisation_id())
  );

-- Service role bypass (for server actions using admin client)
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN VALUES
    ('opportunites'), ('devis'), ('devis_lignes'),
    ('factures'), ('facture_lignes'), ('facture_paiements'),
    ('avoirs'), ('avoir_lignes')
  LOOP
    EXECUTE format(
      'CREATE POLICY "Service role bypass" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END;
$$;

-- ───────────────────────────────────────────
-- TRIGGERS updated_at
-- ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN VALUES
    ('opportunites'), ('devis'), ('factures'), ('avoirs')
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      t
    );
  END LOOP;
END;
$$;
