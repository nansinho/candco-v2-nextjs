-- ═══════════════════════════════════════════
-- C&CO Formation v2 — Sessions & Salles
-- Tables: salles, sessions, session_formateurs, session_commanditaires,
--         inscriptions, session_creneaux, emargements, session_evaluations
-- ═══════════════════════════════════════════

-- ═══════════════════════════════════════════
-- SALLES
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

-- RLS
ALTER TABLE salles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salles_select" ON salles FOR SELECT
  USING (organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()));

CREATE POLICY "salles_insert" ON salles FOR INSERT
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()));

CREATE POLICY "salles_update" ON salles FOR UPDATE
  USING (organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()));

CREATE POLICY "salles_delete" ON salles FOR DELETE
  USING (organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()));

-- ═══════════════════════════════════════════
-- SESSIONS
-- ═══════════════════════════════════════════

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

-- RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select" ON sessions FOR SELECT
  USING (organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()));

CREATE POLICY "sessions_insert" ON sessions FOR INSERT
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()));

CREATE POLICY "sessions_update" ON sessions FOR UPDATE
  USING (organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()));

CREATE POLICY "sessions_delete" ON sessions FOR DELETE
  USING (organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()));

-- Trigger updated_at
CREATE TRIGGER set_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════
-- SESSION_FORMATEURS (many-to-many)
-- ═══════════════════════════════════════════

CREATE TABLE session_formateurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  formateur_id uuid NOT NULL REFERENCES formateurs(id) ON DELETE CASCADE,
  role text DEFAULT 'principal' CHECK (role IN ('principal', 'intervenant')),
  UNIQUE (session_id, formateur_id)
);

CREATE INDEX idx_session_formateurs_session ON session_formateurs(session_id);
CREATE INDEX idx_session_formateurs_formateur ON session_formateurs(formateur_id);

-- RLS (inherits from sessions via join)
ALTER TABLE session_formateurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_formateurs_select" ON session_formateurs FOR SELECT
  USING (session_id IN (SELECT id FROM sessions));

CREATE POLICY "session_formateurs_insert" ON session_formateurs FOR INSERT
  WITH CHECK (session_id IN (SELECT id FROM sessions));

CREATE POLICY "session_formateurs_update" ON session_formateurs FOR UPDATE
  USING (session_id IN (SELECT id FROM sessions));

CREATE POLICY "session_formateurs_delete" ON session_formateurs FOR DELETE
  USING (session_id IN (SELECT id FROM sessions));

-- ═══════════════════════════════════════════
-- SESSION_COMMANDITAIRES (multi-commanditaires)
-- ═══════════════════════════════════════════

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

-- RLS
ALTER TABLE session_commanditaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_commanditaires_select" ON session_commanditaires FOR SELECT
  USING (session_id IN (SELECT id FROM sessions));

CREATE POLICY "session_commanditaires_insert" ON session_commanditaires FOR INSERT
  WITH CHECK (session_id IN (SELECT id FROM sessions));

CREATE POLICY "session_commanditaires_update" ON session_commanditaires FOR UPDATE
  USING (session_id IN (SELECT id FROM sessions));

CREATE POLICY "session_commanditaires_delete" ON session_commanditaires FOR DELETE
  USING (session_id IN (SELECT id FROM sessions));

-- ═══════════════════════════════════════════
-- INSCRIPTIONS (apprenants in sessions)
-- ═══════════════════════════════════════════

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

-- RLS
ALTER TABLE inscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inscriptions_select" ON inscriptions FOR SELECT
  USING (session_id IN (SELECT id FROM sessions));

CREATE POLICY "inscriptions_insert" ON inscriptions FOR INSERT
  WITH CHECK (session_id IN (SELECT id FROM sessions));

CREATE POLICY "inscriptions_update" ON inscriptions FOR UPDATE
  USING (session_id IN (SELECT id FROM sessions));

CREATE POLICY "inscriptions_delete" ON inscriptions FOR DELETE
  USING (session_id IN (SELECT id FROM sessions));

-- ═══════════════════════════════════════════
-- SESSION_CRENEAUX (time slots)
-- ═══════════════════════════════════════════

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

-- RLS
ALTER TABLE session_creneaux ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_creneaux_select" ON session_creneaux FOR SELECT
  USING (session_id IN (SELECT id FROM sessions));

CREATE POLICY "session_creneaux_insert" ON session_creneaux FOR INSERT
  WITH CHECK (session_id IN (SELECT id FROM sessions));

CREATE POLICY "session_creneaux_update" ON session_creneaux FOR UPDATE
  USING (session_id IN (SELECT id FROM sessions));

CREATE POLICY "session_creneaux_delete" ON session_creneaux FOR DELETE
  USING (session_id IN (SELECT id FROM sessions));

-- ═══════════════════════════════════════════
-- EMARGEMENTS (attendance)
-- ═══════════════════════════════════════════

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

-- RLS
ALTER TABLE emargements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emargements_select" ON emargements FOR SELECT
  USING (creneau_id IN (SELECT id FROM session_creneaux));

CREATE POLICY "emargements_insert" ON emargements FOR INSERT
  WITH CHECK (creneau_id IN (SELECT id FROM session_creneaux));

CREATE POLICY "emargements_update" ON emargements FOR UPDATE
  USING (creneau_id IN (SELECT id FROM session_creneaux));

CREATE POLICY "emargements_delete" ON emargements FOR DELETE
  USING (creneau_id IN (SELECT id FROM session_creneaux));

-- ═══════════════════════════════════════════
-- SESSION_EVALUATIONS (linked questionnaires)
-- ═══════════════════════════════════════════

CREATE TABLE session_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  -- questionnaire_id will reference questionnaires table (Phase 4)
  questionnaire_id uuid,
  type text CHECK (type IN ('satisfaction_chaud', 'satisfaction_froid', 'pedagogique_pre', 'pedagogique_post')),
  date_envoi timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_session_evaluations_session ON session_evaluations(session_id);

-- RLS
ALTER TABLE session_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_evaluations_select" ON session_evaluations FOR SELECT
  USING (session_id IN (SELECT id FROM sessions));

CREATE POLICY "session_evaluations_insert" ON session_evaluations FOR INSERT
  WITH CHECK (session_id IN (SELECT id FROM sessions));

CREATE POLICY "session_evaluations_delete" ON session_evaluations FOR DELETE
  USING (session_id IN (SELECT id FROM sessions));
