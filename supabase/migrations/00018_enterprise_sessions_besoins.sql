-- ═══════════════════════════════════════════
-- Migration 00018: Enterprise Sessions View + Besoins de Formation + Session Status Evolution + Financial Tables
-- ═══════════════════════════════════════════

-- ═══════════════════════════════════════════
-- 1. EVOLUTION DES STATUTS DE SESSION
-- Ancien : en_projet, validee, en_cours, terminee, annulee
-- Nouveau : en_creation, validee, a_facturer, terminee
-- Archivage géré par archived_at (pattern existant)
-- ═══════════════════════════════════════════

-- 1a. Migrer les données existantes vers les nouveaux statuts
UPDATE sessions SET statut = 'en_creation' WHERE statut = 'en_projet';
UPDATE sessions SET statut = 'validee' WHERE statut = 'en_cours';
UPDATE sessions SET archived_at = now() WHERE statut = 'annulee' AND archived_at IS NULL;
UPDATE sessions SET statut = 'terminee' WHERE statut = 'annulee';

-- 1b. Modifier la contrainte CHECK
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_statut_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_statut_check
  CHECK (statut IN ('en_creation', 'validee', 'a_facturer', 'terminee'));

-- ═══════════════════════════════════════════
-- 2. TABLE BESOINS DE FORMATION (Plan de formation annuel)
-- ═══════════════════════════════════════════

CREATE TABLE besoins_formation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  -- Contenu du besoin
  intitule text NOT NULL,
  description text,
  public_cible text,                -- Service / équipe / métier ciblé
  -- Localisation
  agence_id uuid REFERENCES entreprise_agences(id) ON DELETE SET NULL,
  siege_entreprise_id uuid REFERENCES entreprises(id) ON DELETE SET NULL,
  -- Planification
  priorite text DEFAULT 'moyenne' NOT NULL CHECK (priorite IN ('faible', 'moyenne', 'haute')),
  annee_cible int NOT NULL,         -- 2026, 2027...
  date_echeance date,
  responsable_id uuid REFERENCES utilisateurs(id) ON DELETE SET NULL,
  -- Workflow
  statut text DEFAULT 'a_etudier' NOT NULL CHECK (statut IN ('a_etudier', 'valide', 'planifie', 'realise')),
  -- Lien vers session (quand le besoin est converti/lié)
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  -- Notes
  notes text,
  -- Méta
  archived_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_besoins_formation_organisation ON besoins_formation(organisation_id);
CREATE INDEX idx_besoins_formation_entreprise ON besoins_formation(entreprise_id);
CREATE INDEX idx_besoins_formation_agence ON besoins_formation(agence_id);
CREATE INDEX idx_besoins_formation_annee ON besoins_formation(annee_cible);
CREATE INDEX idx_besoins_formation_statut ON besoins_formation(statut);
CREATE INDEX idx_besoins_formation_session ON besoins_formation(session_id);

-- RLS
ALTER TABLE besoins_formation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "besoins_formation_select" ON besoins_formation FOR SELECT
  USING (organisation_id = auth_organisation_id());

CREATE POLICY "besoins_formation_insert" ON besoins_formation FOR INSERT
  WITH CHECK (organisation_id = auth_organisation_id());

CREATE POLICY "besoins_formation_update" ON besoins_formation FOR UPDATE
  USING (organisation_id = auth_organisation_id());

CREATE POLICY "besoins_formation_delete" ON besoins_formation FOR DELETE
  USING (organisation_id = auth_organisation_id());

-- Trigger updated_at
CREATE TRIGGER set_besoins_formation_updated_at
  BEFORE UPDATE ON besoins_formation
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════
-- 3. TABLES FINANCIÈRES (fondation pour Phase 5-6)
-- Devis, Factures, Avoirs + lignes + paiements
-- ═══════════════════════════════════════════

-- 3a. Opportunités commerciales (pré-requis devis)
CREATE TABLE IF NOT EXISTS opportunites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  nom text NOT NULL,
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE SET NULL,
  contact_client_id uuid REFERENCES contacts_clients(id) ON DELETE SET NULL,
  montant_estime numeric(10,2),
  statut text DEFAULT 'prospect' CHECK (statut IN ('prospect', 'qualification', 'proposition', 'negociation', 'gagne', 'perdu')),
  date_cloture_prevue date,
  notes text,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_opportunites_organisation ON opportunites(organisation_id);
CREATE INDEX idx_opportunites_entreprise ON opportunites(entreprise_id);

ALTER TABLE opportunites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "opportunites_select" ON opportunites FOR SELECT
  USING (organisation_id = auth_organisation_id());
CREATE POLICY "opportunites_insert" ON opportunites FOR INSERT
  WITH CHECK (organisation_id = auth_organisation_id());
CREATE POLICY "opportunites_update" ON opportunites FOR UPDATE
  USING (organisation_id = auth_organisation_id());
CREATE POLICY "opportunites_delete" ON opportunites FOR DELETE
  USING (organisation_id = auth_organisation_id());

CREATE TRIGGER set_opportunites_updated_at
  BEFORE UPDATE ON opportunites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3b. DEVIS
CREATE TABLE devis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  numero_affichage text,             -- D-2026-0033
  -- Destinataire
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE SET NULL,
  contact_client_id uuid REFERENCES contacts_clients(id) ON DELETE SET NULL,
  particulier_nom text,
  particulier_email text,
  particulier_adresse text,
  -- Dates
  date_emission date NOT NULL,
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
  statut text DEFAULT 'brouillon' NOT NULL CHECK (statut IN ('brouillon', 'envoye', 'signe', 'refuse', 'expire')),
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

CREATE INDEX idx_devis_organisation ON devis(organisation_id);
CREATE INDEX idx_devis_entreprise ON devis(entreprise_id);
CREATE INDEX idx_devis_session ON devis(session_id);
CREATE INDEX idx_devis_statut ON devis(statut);

ALTER TABLE devis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "devis_select" ON devis FOR SELECT
  USING (organisation_id = auth_organisation_id());
CREATE POLICY "devis_insert" ON devis FOR INSERT
  WITH CHECK (organisation_id = auth_organisation_id());
CREATE POLICY "devis_update" ON devis FOR UPDATE
  USING (organisation_id = auth_organisation_id());
CREATE POLICY "devis_delete" ON devis FOR DELETE
  USING (organisation_id = auth_organisation_id());

CREATE TRIGGER set_devis_updated_at
  BEFORE UPDATE ON devis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3c. DEVIS LIGNES
CREATE TABLE devis_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id uuid NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
  designation text NOT NULL,
  description text,
  quantite numeric(10,2) DEFAULT 1,
  prix_unitaire_ht numeric(10,2),
  taux_tva numeric(5,2) DEFAULT 0,
  montant_ht numeric(10,2),
  ordre int,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_devis_lignes_devis ON devis_lignes(devis_id);

ALTER TABLE devis_lignes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "devis_lignes_select" ON devis_lignes FOR SELECT
  USING (devis_id IN (SELECT id FROM devis));
CREATE POLICY "devis_lignes_insert" ON devis_lignes FOR INSERT
  WITH CHECK (devis_id IN (SELECT id FROM devis));
CREATE POLICY "devis_lignes_update" ON devis_lignes FOR UPDATE
  USING (devis_id IN (SELECT id FROM devis));
CREATE POLICY "devis_lignes_delete" ON devis_lignes FOR DELETE
  USING (devis_id IN (SELECT id FROM devis));

-- 3d. FACTURES
CREATE TABLE factures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  numero_affichage text,             -- F-2026-0015
  -- Destinataire
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE SET NULL,
  contact_client_id uuid REFERENCES contacts_clients(id) ON DELETE SET NULL,
  -- Dates
  date_emission date NOT NULL,
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
  statut text DEFAULT 'brouillon' NOT NULL CHECK (statut IN ('brouillon', 'envoyee', 'payee', 'partiellement_payee', 'en_retard')),
  envoye_le timestamptz,
  -- Relations
  devis_id uuid REFERENCES devis(id) ON DELETE SET NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  -- Méta
  archived_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_factures_organisation ON factures(organisation_id);
CREATE INDEX idx_factures_entreprise ON factures(entreprise_id);
CREATE INDEX idx_factures_session ON factures(session_id);
CREATE INDEX idx_factures_statut ON factures(statut);
CREATE INDEX idx_factures_devis ON factures(devis_id);

ALTER TABLE factures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "factures_select" ON factures FOR SELECT
  USING (organisation_id = auth_organisation_id());
CREATE POLICY "factures_insert" ON factures FOR INSERT
  WITH CHECK (organisation_id = auth_organisation_id());
CREATE POLICY "factures_update" ON factures FOR UPDATE
  USING (organisation_id = auth_organisation_id());
CREATE POLICY "factures_delete" ON factures FOR DELETE
  USING (organisation_id = auth_organisation_id());

CREATE TRIGGER set_factures_updated_at
  BEFORE UPDATE ON factures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3e. FACTURE LIGNES
CREATE TABLE facture_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  designation text NOT NULL,
  description text,
  quantite numeric(10,2) DEFAULT 1,
  prix_unitaire_ht numeric(10,2),
  taux_tva numeric(5,2) DEFAULT 0,
  montant_ht numeric(10,2),
  ordre int,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_facture_lignes_facture ON facture_lignes(facture_id);

ALTER TABLE facture_lignes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facture_lignes_select" ON facture_lignes FOR SELECT
  USING (facture_id IN (SELECT id FROM factures));
CREATE POLICY "facture_lignes_insert" ON facture_lignes FOR INSERT
  WITH CHECK (facture_id IN (SELECT id FROM factures));
CREATE POLICY "facture_lignes_update" ON facture_lignes FOR UPDATE
  USING (facture_id IN (SELECT id FROM factures));
CREATE POLICY "facture_lignes_delete" ON facture_lignes FOR DELETE
  USING (facture_id IN (SELECT id FROM factures));

-- 3f. FACTURE PAIEMENTS
CREATE TABLE facture_paiements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  date_paiement date NOT NULL,
  montant numeric(10,2) NOT NULL,
  mode text,                         -- virement, cheque, cb, especes
  reference text,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_facture_paiements_facture ON facture_paiements(facture_id);

ALTER TABLE facture_paiements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facture_paiements_select" ON facture_paiements FOR SELECT
  USING (facture_id IN (SELECT id FROM factures));
CREATE POLICY "facture_paiements_insert" ON facture_paiements FOR INSERT
  WITH CHECK (facture_id IN (SELECT id FROM factures));
CREATE POLICY "facture_paiements_update" ON facture_paiements FOR UPDATE
  USING (facture_id IN (SELECT id FROM factures));
CREATE POLICY "facture_paiements_delete" ON facture_paiements FOR DELETE
  USING (facture_id IN (SELECT id FROM factures));

-- 3g. AVOIRS
CREATE TABLE avoirs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  numero_affichage text,             -- A-2026-0001
  facture_id uuid REFERENCES factures(id) ON DELETE SET NULL,
  date_emission date NOT NULL,
  motif text,
  total_ht numeric(10,2),
  total_tva numeric(10,2),
  total_ttc numeric(10,2),
  statut text DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'emis', 'applique')),
  archived_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_avoirs_organisation ON avoirs(organisation_id);
CREATE INDEX idx_avoirs_facture ON avoirs(facture_id);

ALTER TABLE avoirs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avoirs_select" ON avoirs FOR SELECT
  USING (organisation_id = auth_organisation_id());
CREATE POLICY "avoirs_insert" ON avoirs FOR INSERT
  WITH CHECK (organisation_id = auth_organisation_id());
CREATE POLICY "avoirs_update" ON avoirs FOR UPDATE
  USING (organisation_id = auth_organisation_id());
CREATE POLICY "avoirs_delete" ON avoirs FOR DELETE
  USING (organisation_id = auth_organisation_id());

CREATE TRIGGER set_avoirs_updated_at
  BEFORE UPDATE ON avoirs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3h. AVOIR LIGNES
CREATE TABLE avoir_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avoir_id uuid NOT NULL REFERENCES avoirs(id) ON DELETE CASCADE,
  designation text NOT NULL,
  description text,
  quantite numeric(10,2),
  prix_unitaire_ht numeric(10,2),
  taux_tva numeric(5,2) DEFAULT 0,
  montant_ht numeric(10,2),
  ordre int,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_avoir_lignes_avoir ON avoir_lignes(avoir_id);

ALTER TABLE avoir_lignes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avoir_lignes_select" ON avoir_lignes FOR SELECT
  USING (avoir_id IN (SELECT id FROM avoirs));
CREATE POLICY "avoir_lignes_insert" ON avoir_lignes FOR INSERT
  WITH CHECK (avoir_id IN (SELECT id FROM avoirs));
CREATE POLICY "avoir_lignes_update" ON avoir_lignes FOR UPDATE
  USING (avoir_id IN (SELECT id FROM avoirs));
CREATE POLICY "avoir_lignes_delete" ON avoir_lignes FOR DELETE
  USING (avoir_id IN (SELECT id FROM avoirs));

-- ═══════════════════════════════════════════
-- 4. AJOUT SEQUENCES POUR LES NOUVEAUX TYPES
-- ═══════════════════════════════════════════

-- Les séquences seront créées automatiquement via la fonction next_numero
-- quand on insérera le premier devis/facture/avoir pour chaque org.
-- Pas besoin d'INSERT préventif ici.
