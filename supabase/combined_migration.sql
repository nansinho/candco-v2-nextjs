-- ═══════════════════════════════════════════════════════════
-- C&CO Formation v2 — COMBINED MIGRATION
-- Run this in Supabase Studio SQL Editor
-- Contains: 00001 + 00002 + 00003 + 00004
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════
-- MIGRATION 00001 — Initial Schema
-- ═══════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ORGANISATION / MULTI-TENANT
CREATE TABLE organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  siret text,
  nda text,
  email text,
  telephone text,
  adresse_rue text,
  adresse_complement text,
  adresse_cp text,
  adresse_ville text,
  logo_url text,
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE utilisateurs (
  id uuid PRIMARY KEY,  -- = auth.users.id
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email text NOT NULL,
  prenom text,
  nom text,
  role text DEFAULT 'admin' NOT NULL CHECK (role IN ('admin', 'manager', 'user')),
  avatar_url text,
  actif boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_utilisateurs_organisation ON utilisateurs(organisation_id);
CREATE INDEX idx_utilisateurs_email ON utilisateurs(email);

-- TABLES DE RÉFÉRENCE
CREATE TABLE bpf_categories_entreprise (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  libelle text NOT NULL,
  ordre int
);

INSERT INTO bpf_categories_entreprise (code, libelle, ordre) VALUES
  ('C.1', 'Entreprises pour formation salariés', 1),
  ('C.2.a', 'Contrats d''apprentissage', 2),
  ('C.2.b', 'Contrats de professionnalisation', 3),
  ('C.2.c', 'Promotion ou reconversion professionnelle', 4),
  ('C.7', 'Pouvoirs publics (type 1)', 5),
  ('C.8', 'Pouvoirs publics (type 2)', 6),
  ('C.9', 'Contrats personnes', 7),
  ('C.10', 'Contrats autres organismes', 8),
  ('C.11', 'Autres produits formation professionnelle', 9);

CREATE TABLE bpf_categories_apprenant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  libelle text NOT NULL,
  ordre int
);

INSERT INTO bpf_categories_apprenant (code, libelle, ordre) VALUES
  ('F.1.a', 'Salariés', 1),
  ('F.1.b', 'Salariés en contrat en alternance', 2),
  ('F.2', 'Demandeurs d''emploi', 3),
  ('F.3', 'Travailleurs non salariés', 4),
  ('F.4', 'Particuliers à leurs propres frais', 5),
  ('F.5', 'Autres', 6);

CREATE TABLE bpf_specialites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text,
  libelle text NOT NULL,
  ordre int
);

CREATE TABLE sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  entite text NOT NULL,
  compteur int DEFAULT 0 NOT NULL,
  UNIQUE (organisation_id, entite)
);

CREATE INDEX idx_sequences_org_entite ON sequences(organisation_id, entite);

-- CRM — BASE DE CONTACTS
CREATE TABLE entreprises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  numero_affichage text,
  nom text NOT NULL,
  siret text,
  email text,
  telephone text,
  adresse_rue text,
  adresse_complement text,
  adresse_cp text,
  adresse_ville text,
  facturation_raison_sociale text,
  facturation_rue text,
  facturation_complement text,
  facturation_cp text,
  facturation_ville text,
  bpf_categorie_id uuid REFERENCES bpf_categories_entreprise(id),
  numero_compte_comptable text DEFAULT '411000',
  archived_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_entreprises_org ON entreprises(organisation_id);

CREATE TABLE apprenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  numero_affichage text,
  civilite text,
  prenom text NOT NULL,
  nom text NOT NULL,
  nom_naissance text,
  email text,
  telephone text,
  date_naissance date,
  fonction text,
  lieu_activite text,
  adresse_rue text,
  adresse_complement text,
  adresse_cp text,
  adresse_ville text,
  bpf_categorie_id uuid REFERENCES bpf_categories_apprenant(id),
  numero_compte_comptable text,
  pennylane_id text,
  lms_id text,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_apprenants_org ON apprenants(organisation_id);

CREATE TABLE apprenant_entreprises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apprenant_id uuid NOT NULL REFERENCES apprenants(id) ON DELETE CASCADE,
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  UNIQUE (apprenant_id, entreprise_id)
);

CREATE TABLE contacts_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  numero_affichage text,
  civilite text,
  prenom text NOT NULL,
  nom text NOT NULL,
  email text,
  telephone text,
  fonction text,
  extranet_actif boolean DEFAULT false,
  extranet_user_id uuid,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_contacts_clients_org ON contacts_clients(organisation_id);

CREATE TABLE contact_entreprises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_client_id uuid NOT NULL REFERENCES contacts_clients(id) ON DELETE CASCADE,
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  UNIQUE (contact_client_id, entreprise_id)
);

CREATE TABLE formateurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  numero_affichage text,
  civilite text,
  prenom text NOT NULL,
  nom text NOT NULL,
  email text,
  telephone text,
  adresse_rue text,
  adresse_complement text,
  adresse_cp text,
  adresse_ville text,
  statut_bpf text NOT NULL DEFAULT 'externe' CHECK (statut_bpf IN ('interne', 'externe')),
  nda text,
  siret text,
  tarif_journalier numeric(10,2),
  taux_tva numeric(5,2) DEFAULT 0,
  heures_par_jour numeric(4,2) DEFAULT 7,
  extranet_actif boolean DEFAULT false,
  extranet_user_id uuid,
  lien_calendrier_ical text,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_formateurs_org ON formateurs(organisation_id);

CREATE TABLE formateur_competences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formateur_id uuid NOT NULL REFERENCES formateurs(id) ON DELETE CASCADE,
  competence text NOT NULL
);

CREATE TABLE financeurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  numero_affichage text,
  nom text NOT NULL,
  type text,
  siret text,
  email text,
  telephone text,
  adresse_rue text,
  adresse_complement text,
  adresse_cp text,
  adresse_ville text,
  numero_compte_comptable text,
  bpf_categorie_id uuid REFERENCES bpf_categories_entreprise(id),
  archived_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_financeurs_org ON financeurs(organisation_id);

-- TÂCHES & ACTIVITÉS
CREATE TABLE taches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  titre text NOT NULL,
  description text,
  statut text DEFAULT 'a_faire' NOT NULL CHECK (statut IN ('a_faire', 'en_cours', 'terminee')),
  priorite text DEFAULT 'normale' NOT NULL CHECK (priorite IN ('basse', 'normale', 'haute', 'urgente')),
  date_echeance date,
  assignee_id uuid REFERENCES utilisateurs(id),
  entite_type text,
  entite_id uuid,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_taches_org ON taches(organisation_id);
CREATE INDEX idx_taches_entite ON taches(entite_type, entite_id);

CREATE TABLE activites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  auteur_id uuid REFERENCES utilisateurs(id),
  contenu text NOT NULL,
  entite_type text,
  entite_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_activites_org ON activites(organisation_id);
CREATE INDEX idx_activites_entite ON activites(entite_type, entite_id);

-- FUNCTION: next_numero
CREATE OR REPLACE FUNCTION next_numero(
  p_organisation_id uuid,
  p_entite text,
  p_year int DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_compteur int;
BEGIN
  INSERT INTO sequences (organisation_id, entite, compteur)
  VALUES (p_organisation_id, p_entite, 1)
  ON CONFLICT (organisation_id, entite)
  DO UPDATE SET compteur = sequences.compteur + 1
  RETURNING compteur INTO v_compteur;

  IF p_year IS NOT NULL THEN
    RETURN p_entite || '-' || p_year || '-' || lpad(v_compteur::text, 4, '0');
  ELSE
    RETURN p_entite || '-' || lpad(v_compteur::text, 4, '0');
  END IF;
END;
$$;

-- UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables with updated_at
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at'
    AND table_schema = 'public'
    AND table_name NOT IN ('schema_migrations')
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      t
    );
  END LOOP;
END;
$$;

-- ROW LEVEL SECURITY
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE utilisateurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE entreprises ENABLE ROW LEVEL SECURITY;
ALTER TABLE apprenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE apprenant_entreprises ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_entreprises ENABLE ROW LEVEL SECURITY;
ALTER TABLE formateurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE formateur_competences ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE taches ENABLE ROW LEVEL SECURITY;
ALTER TABLE activites ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's organisation_id
CREATE OR REPLACE FUNCTION auth_organisation_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
$$;

-- Policies for organisations
CREATE POLICY "Users can view their organisation"
  ON organisations FOR SELECT
  USING (id = auth_organisation_id());

CREATE POLICY "Admins can update their organisation"
  ON organisations FOR UPDATE
  USING (id = auth_organisation_id());

-- Policies for utilisateurs
CREATE POLICY "Users can view org users"
  ON utilisateurs FOR SELECT
  USING (organisation_id = auth_organisation_id());

CREATE POLICY "Users can update their own profile"
  ON utilisateurs FOR UPDATE
  USING (id = auth.uid());

-- Generic multi-tenant policy for entity tables
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN VALUES
    ('entreprises'), ('apprenants'), ('contacts_clients'),
    ('formateurs'), ('financeurs'), ('sequences'),
    ('taches'), ('activites')
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

-- Junction table policies
CREATE POLICY "Access through apprenant" ON apprenant_entreprises
  FOR ALL USING (
    EXISTS (SELECT 1 FROM apprenants WHERE id = apprenant_id AND organisation_id = auth_organisation_id())
  );

CREATE POLICY "Access through contact" ON contact_entreprises
  FOR ALL USING (
    EXISTS (SELECT 1 FROM contacts_clients WHERE id = contact_client_id AND organisation_id = auth_organisation_id())
  );

CREATE POLICY "Access through formateur" ON formateur_competences
  FOR ALL USING (
    EXISTS (SELECT 1 FROM formateurs WHERE id = formateur_id AND organisation_id = auth_organisation_id())
  );

-- ═══════════════════════════════════════════
-- MIGRATION 00002 — Produits de formation
-- ═══════════════════════════════════════════

CREATE TABLE produits_formation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  numero_affichage text,
  intitule text NOT NULL,
  sous_titre text,
  description text,
  identifiant_interne text,
  domaine text,
  type_action text CHECK (type_action IN ('action_formation', 'bilan_competences', 'vae', 'apprentissage')),
  modalite text CHECK (modalite IN ('presentiel', 'distanciel', 'mixte', 'afest')),
  formule text CHECK (formule IN ('inter', 'intra', 'individuel')),
  duree_heures numeric(8,2),
  duree_jours numeric(8,2),
  bpf_specialite_id uuid REFERENCES bpf_specialites(id),
  bpf_categorie text CHECK (bpf_categorie IN ('A', 'B', 'C')),
  bpf_niveau text CHECK (bpf_niveau IN ('I', 'II', 'III', 'IV', 'V')),
  publie boolean DEFAULT false,
  populaire boolean DEFAULT false,
  slug text,
  image_url text,
  completion_pct int DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_produits_formation_org ON produits_formation(organisation_id);
CREATE INDEX idx_produits_formation_slug ON produits_formation(slug) WHERE slug IS NOT NULL;

CREATE TABLE produit_tarifs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES produits_formation(id) ON DELETE CASCADE,
  nom text,
  prix_ht numeric(10,2),
  taux_tva numeric(5,2) DEFAULT 0,
  unite text CHECK (unite IN ('stagiaire', 'groupe', 'jour', 'heure', 'forfait')),
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_produit_tarifs_produit ON produit_tarifs(produit_id);

CREATE TABLE produit_objectifs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES produits_formation(id) ON DELETE CASCADE,
  objectif text NOT NULL,
  ordre int DEFAULT 0
);

CREATE INDEX idx_produit_objectifs_produit ON produit_objectifs(produit_id);

CREATE TABLE produit_programme (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES produits_formation(id) ON DELETE CASCADE,
  titre text NOT NULL,
  contenu text,
  duree text,
  ordre int DEFAULT 0
);

CREATE INDEX idx_produit_programme_produit ON produit_programme(produit_id);

CREATE TABLE produit_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES produits_formation(id) ON DELETE CASCADE,
  nom text NOT NULL,
  categorie text CHECK (categorie IN ('programme', 'plaquette', 'convention', 'attestation', 'autre')),
  fichier_url text,
  genere boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_produit_documents_produit ON produit_documents(produit_id);

-- RLS for produits
ALTER TABLE produits_formation ENABLE ROW LEVEL SECURITY;
ALTER TABLE produit_tarifs ENABLE ROW LEVEL SECURITY;
ALTER TABLE produit_objectifs ENABLE ROW LEVEL SECURITY;
ALTER TABLE produit_programme ENABLE ROW LEVEL SECURITY;
ALTER TABLE produit_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org isolation select" ON produits_formation FOR SELECT
  USING (organisation_id = auth_organisation_id());
CREATE POLICY "Org isolation insert" ON produits_formation FOR INSERT
  WITH CHECK (organisation_id = auth_organisation_id());
CREATE POLICY "Org isolation update" ON produits_formation FOR UPDATE
  USING (organisation_id = auth_organisation_id());
CREATE POLICY "Org isolation delete" ON produits_formation FOR DELETE
  USING (organisation_id = auth_organisation_id());

CREATE POLICY "Access through produit" ON produit_tarifs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM produits_formation WHERE id = produit_id AND organisation_id = auth_organisation_id())
  );

CREATE POLICY "Access through produit" ON produit_objectifs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM produits_formation WHERE id = produit_id AND organisation_id = auth_organisation_id())
  );

CREATE POLICY "Access through produit" ON produit_programme
  FOR ALL USING (
    EXISTS (SELECT 1 FROM produits_formation WHERE id = produit_id AND organisation_id = auth_organisation_id())
  );

CREATE POLICY "Access through produit" ON produit_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM produits_formation WHERE id = produit_id AND organisation_id = auth_organisation_id())
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON produits_formation
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON produit_tarifs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════
-- MIGRATION 00003 — Fixes + Enterprise Org Structure
-- ═══════════════════════════════════════════

-- Additional indexes
CREATE INDEX IF NOT EXISTS idx_contact_entreprises_contact ON contact_entreprises(contact_client_id);
CREATE INDEX IF NOT EXISTS idx_contact_entreprises_entreprise ON contact_entreprises(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_apprenant_entreprises_apprenant ON apprenant_entreprises(apprenant_id);
CREATE INDEX IF NOT EXISTS idx_apprenant_entreprises_entreprise ON apprenant_entreprises(entreprise_id);

CREATE TABLE entreprise_agences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  nom text NOT NULL,
  siret text,
  adresse_rue text,
  adresse_complement text,
  adresse_cp text,
  adresse_ville text,
  telephone text,
  email text,
  est_siege boolean DEFAULT false,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE entreprise_poles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  agence_id uuid REFERENCES entreprise_agences(id) ON DELETE SET NULL,
  nom text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE entreprise_membres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  agence_id uuid REFERENCES entreprise_agences(id) ON DELETE SET NULL,
  pole_id uuid REFERENCES entreprise_poles(id) ON DELETE SET NULL,
  apprenant_id uuid REFERENCES apprenants(id) ON DELETE CASCADE,
  contact_client_id uuid REFERENCES contacts_clients(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'employe',
  fonction text,
  CONSTRAINT check_membre_link CHECK (apprenant_id IS NOT NULL OR contact_client_id IS NOT NULL),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_agences_entreprise ON entreprise_agences(entreprise_id);
CREATE INDEX idx_poles_entreprise ON entreprise_poles(entreprise_id);
CREATE INDEX idx_poles_agence ON entreprise_poles(agence_id);
CREATE INDEX idx_membres_entreprise ON entreprise_membres(entreprise_id);
CREATE INDEX idx_membres_agence ON entreprise_membres(agence_id);
CREATE INDEX idx_membres_pole ON entreprise_membres(pole_id);
CREATE INDEX idx_membres_apprenant ON entreprise_membres(apprenant_id);
CREATE INDEX idx_membres_contact ON entreprise_membres(contact_client_id);

CREATE TRIGGER update_entreprise_agences_updated_at
  BEFORE UPDATE ON entreprise_agences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_entreprise_poles_updated_at
  BEFORE UPDATE ON entreprise_poles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_entreprise_membres_updated_at
  BEFORE UPDATE ON entreprise_membres
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE entreprise_agences ENABLE ROW LEVEL SECURITY;
ALTER TABLE entreprise_poles ENABLE ROW LEVEL SECURITY;
ALTER TABLE entreprise_membres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access through entreprise" ON entreprise_agences
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = entreprise_id
      AND organisation_id = (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Access through entreprise" ON entreprise_poles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = entreprise_id
      AND organisation_id = (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Access through entreprise" ON entreprise_membres
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = entreprise_id
      AND organisation_id = (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

-- ═══════════════════════════════════════════
-- MIGRATION 00004 — Sessions & Salles
-- ═══════════════════════════════════════════

CREATE TABLE salles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  nom text NOT NULL,
  adresse text,
  capacite int,
  equipements text,
  actif boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_salles_organisation ON salles(organisation_id);

ALTER TABLE salles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salles_select" ON salles FOR SELECT
  USING (organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()));
CREATE POLICY "salles_insert" ON salles FOR INSERT
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()));
CREATE POLICY "salles_update" ON salles FOR UPDATE
  USING (organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()));
CREATE POLICY "salles_delete" ON salles FOR DELETE
  USING (organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()));

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  numero_affichage text,
  produit_id uuid REFERENCES produits_formation(id) ON DELETE SET NULL,
  nom text NOT NULL,
  statut text DEFAULT 'en_projet' NOT NULL CHECK (statut IN ('en_projet', 'validee', 'en_cours', 'terminee', 'annulee')),
  date_debut date,
  date_fin date,
  places_min int,
  places_max int,
  lieu_salle_id uuid REFERENCES salles(id) ON DELETE SET NULL,
  lieu_adresse text,
  lieu_type text CHECK (lieu_type IS NULL OR lieu_type IN ('presentiel', 'distanciel', 'mixte')),
  emargement_auto boolean DEFAULT false NOT NULL,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_sessions_organisation ON sessions(organisation_id);
CREATE INDEX idx_sessions_produit ON sessions(produit_id);
CREATE INDEX idx_sessions_statut ON sessions(statut);
CREATE INDEX idx_sessions_dates ON sessions(date_debut, date_fin);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select" ON sessions FOR SELECT
  USING (organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()));
CREATE POLICY "sessions_insert" ON sessions FOR INSERT
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()));
CREATE POLICY "sessions_update" ON sessions FOR UPDATE
  USING (organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()));
CREATE POLICY "sessions_delete" ON sessions FOR DELETE
  USING (organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()));

-- FIX: use update_updated_at (not update_updated_at_column)
CREATE TRIGGER set_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE session_formateurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  formateur_id uuid NOT NULL REFERENCES formateurs(id) ON DELETE CASCADE,
  role text DEFAULT 'principal' CHECK (role IN ('principal', 'intervenant')),
  UNIQUE (session_id, formateur_id)
);

CREATE INDEX idx_session_formateurs_session ON session_formateurs(session_id);
CREATE INDEX idx_session_formateurs_formateur ON session_formateurs(formateur_id);

ALTER TABLE session_formateurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_formateurs_select" ON session_formateurs FOR SELECT
  USING (session_id IN (SELECT id FROM sessions));
CREATE POLICY "session_formateurs_insert" ON session_formateurs FOR INSERT
  WITH CHECK (session_id IN (SELECT id FROM sessions));
CREATE POLICY "session_formateurs_update" ON session_formateurs FOR UPDATE
  USING (session_id IN (SELECT id FROM sessions));
CREATE POLICY "session_formateurs_delete" ON session_formateurs FOR DELETE
  USING (session_id IN (SELECT id FROM sessions));

CREATE TABLE session_commanditaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE SET NULL,
  contact_client_id uuid REFERENCES contacts_clients(id) ON DELETE SET NULL,
  financeur_id uuid REFERENCES financeurs(id) ON DELETE SET NULL,
  convention_signee boolean DEFAULT false NOT NULL,
  convention_url text,
  budget numeric(10,2) DEFAULT 0,
  statut_workflow text DEFAULT 'analyse' CHECK (statut_workflow IN ('analyse', 'convention', 'signature', 'facturation', 'termine')),
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_session_commanditaires_session ON session_commanditaires(session_id);
CREATE INDEX idx_session_commanditaires_entreprise ON session_commanditaires(entreprise_id);

ALTER TABLE session_commanditaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_commanditaires_select" ON session_commanditaires FOR SELECT
  USING (session_id IN (SELECT id FROM sessions));
CREATE POLICY "session_commanditaires_insert" ON session_commanditaires FOR INSERT
  WITH CHECK (session_id IN (SELECT id FROM sessions));
CREATE POLICY "session_commanditaires_update" ON session_commanditaires FOR UPDATE
  USING (session_id IN (SELECT id FROM sessions));
CREATE POLICY "session_commanditaires_delete" ON session_commanditaires FOR DELETE
  USING (session_id IN (SELECT id FROM sessions));

CREATE TABLE inscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  apprenant_id uuid NOT NULL REFERENCES apprenants(id) ON DELETE CASCADE,
  commanditaire_id uuid REFERENCES session_commanditaires(id) ON DELETE SET NULL,
  statut text DEFAULT 'inscrit' NOT NULL CHECK (statut IN ('inscrit', 'confirme', 'annule', 'liste_attente')),
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (session_id, apprenant_id)
);

CREATE INDEX idx_inscriptions_session ON inscriptions(session_id);
CREATE INDEX idx_inscriptions_apprenant ON inscriptions(apprenant_id);
CREATE INDEX idx_inscriptions_commanditaire ON inscriptions(commanditaire_id);

ALTER TABLE inscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inscriptions_select" ON inscriptions FOR SELECT
  USING (session_id IN (SELECT id FROM sessions));
CREATE POLICY "inscriptions_insert" ON inscriptions FOR INSERT
  WITH CHECK (session_id IN (SELECT id FROM sessions));
CREATE POLICY "inscriptions_update" ON inscriptions FOR UPDATE
  USING (session_id IN (SELECT id FROM sessions));
CREATE POLICY "inscriptions_delete" ON inscriptions FOR DELETE
  USING (session_id IN (SELECT id FROM sessions));

CREATE TABLE session_creneaux (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  date date NOT NULL,
  heure_debut time NOT NULL,
  heure_fin time NOT NULL,
  duree_minutes int GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (heure_fin - heure_debut)) / 60
  ) STORED,
  formateur_id uuid REFERENCES formateurs(id) ON DELETE SET NULL,
  salle_id uuid REFERENCES salles(id) ON DELETE SET NULL,
  type text DEFAULT 'presentiel' CHECK (type IN ('presentiel', 'distanciel', 'elearning', 'stage')),
  emargement_ouvert boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_session_creneaux_session ON session_creneaux(session_id);
CREATE INDEX idx_session_creneaux_date ON session_creneaux(date);
CREATE INDEX idx_session_creneaux_formateur ON session_creneaux(formateur_id);

ALTER TABLE session_creneaux ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_creneaux_select" ON session_creneaux FOR SELECT
  USING (session_id IN (SELECT id FROM sessions));
CREATE POLICY "session_creneaux_insert" ON session_creneaux FOR INSERT
  WITH CHECK (session_id IN (SELECT id FROM sessions));
CREATE POLICY "session_creneaux_update" ON session_creneaux FOR UPDATE
  USING (session_id IN (SELECT id FROM sessions));
CREATE POLICY "session_creneaux_delete" ON session_creneaux FOR DELETE
  USING (session_id IN (SELECT id FROM sessions));

CREATE TABLE emargements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creneau_id uuid NOT NULL REFERENCES session_creneaux(id) ON DELETE CASCADE,
  apprenant_id uuid NOT NULL REFERENCES apprenants(id) ON DELETE CASCADE,
  present boolean,
  signature_url text,
  heure_signature timestamptz,
  ip_address text,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (creneau_id, apprenant_id)
);

CREATE INDEX idx_emargements_creneau ON emargements(creneau_id);
CREATE INDEX idx_emargements_apprenant ON emargements(apprenant_id);

ALTER TABLE emargements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emargements_select" ON emargements FOR SELECT
  USING (creneau_id IN (SELECT id FROM session_creneaux));
CREATE POLICY "emargements_insert" ON emargements FOR INSERT
  WITH CHECK (creneau_id IN (SELECT id FROM session_creneaux));
CREATE POLICY "emargements_update" ON emargements FOR UPDATE
  USING (creneau_id IN (SELECT id FROM session_creneaux));
CREATE POLICY "emargements_delete" ON emargements FOR DELETE
  USING (creneau_id IN (SELECT id FROM session_creneaux));

CREATE TABLE session_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  questionnaire_id uuid,
  type text CHECK (type IN ('satisfaction_chaud', 'satisfaction_froid', 'pedagogique_pre', 'pedagogique_post')),
  date_envoi timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_session_evaluations_session ON session_evaluations(session_id);

ALTER TABLE session_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_evaluations_select" ON session_evaluations FOR SELECT
  USING (session_id IN (SELECT id FROM sessions));
CREATE POLICY "session_evaluations_insert" ON session_evaluations FOR INSERT
  WITH CHECK (session_id IN (SELECT id FROM sessions));
CREATE POLICY "session_evaluations_delete" ON session_evaluations FOR DELETE
  USING (session_id IN (SELECT id FROM sessions));

-- ═══════════════════════════════════════════
-- MIGRATION 00005 — Fonctions prédéfinies
-- ═══════════════════════════════════════════

CREATE TABLE fonctions_predefinies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  nom text NOT NULL,
  ordre int DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (organisation_id, nom)
);

CREATE INDEX idx_fonctions_predefinies_org ON fonctions_predefinies(organisation_id);

ALTER TABLE fonctions_predefinies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access own org fonctions" ON fonctions_predefinies
  FOR ALL USING (
    organisation_id = (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════
-- DONE — All 5 migrations applied
-- ═══════════════════════════════════════════
