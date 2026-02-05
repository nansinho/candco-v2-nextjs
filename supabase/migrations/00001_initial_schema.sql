-- ═══════════════════════════════════════════
-- C&CO Formation v2 — Initial Schema
-- Tables: organisations, utilisateurs, sequences, bpf_categories
-- ═══════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════
-- ORGANISATION / MULTI-TENANT
-- ═══════════════════════════════════════════

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

-- ═══════════════════════════════════════════
-- TABLES DE RÉFÉRENCE
-- ═══════════════════════════════════════════

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

-- ═══════════════════════════════════════════
-- CRM — BASE DE CONTACTS
-- ═══════════════════════════════════════════

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

-- ═══════════════════════════════════════════
-- TÂCHES & ACTIVITÉS
-- ═══════════════════════════════════════════

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

-- ═══════════════════════════════════════════
-- FUNCTION: next_numero
-- Generates display numbers like APP-0001, D-2026-0001
-- ═══════════════════════════════════════════

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
  v_prefix text;
BEGIN
  -- Upsert and increment counter
  INSERT INTO sequences (organisation_id, entite, compteur)
  VALUES (p_organisation_id, p_entite, 1)
  ON CONFLICT (organisation_id, entite)
  DO UPDATE SET compteur = sequences.compteur + 1
  RETURNING compteur INTO v_compteur;

  -- Format: PREFIX-0001 or PREFIX-YEAR-0001
  IF p_year IS NOT NULL THEN
    RETURN p_entite || '-' || p_year || '-' || lpad(v_compteur::text, 4, '0');
  ELSE
    RETURN p_entite || '-' || lpad(v_compteur::text, 4, '0');
  END IF;
END;
$$;

-- ═══════════════════════════════════════════
-- UPDATED_AT TRIGGER
-- ═══════════════════════════════════════════

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

-- ═══════════════════════════════════════════
-- ROW LEVEL SECURITY (Multi-tenant)
-- ═══════════════════════════════════════════

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
AS $$
  SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
$$;

-- Policies for each table
-- Organisations: users can only see their own org
CREATE POLICY "Users can view their organisation"
  ON organisations FOR SELECT
  USING (id = auth_organisation_id());

CREATE POLICY "Admins can update their organisation"
  ON organisations FOR UPDATE
  USING (id = auth_organisation_id());

-- Utilisateurs: users can see their org's users
CREATE POLICY "Users can view org users"
  ON utilisateurs FOR SELECT
  USING (organisation_id = auth_organisation_id());

CREATE POLICY "Users can update their own profile"
  ON utilisateurs FOR UPDATE
  USING (id = auth.uid());

-- Generic multi-tenant policy for all entity tables
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

-- Junction tables: access through parent
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
