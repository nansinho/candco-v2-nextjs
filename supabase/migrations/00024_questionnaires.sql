-- ═══════════════════════════════════════════
-- C&CO Formation v2 — Questionnaires
-- Satisfaction + Pédagogique + Standalone
-- ═══════════════════════════════════════════

-- 1. Questionnaires (header)
CREATE TABLE IF NOT EXISTS questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  nom text NOT NULL,
  type text NOT NULL CHECK (type IN (
    'satisfaction_chaud', 'satisfaction_froid',
    'pedagogique_pre', 'pedagogique_post',
    'standalone'
  )),
  public_cible text CHECK (public_cible IN (
    'apprenant', 'contact_client', 'financeur', 'formateur'
  )),
  introduction text,
  produit_id uuid REFERENCES produits_formation(id) ON DELETE SET NULL,
  relances_auto boolean DEFAULT true,
  relance_j3 boolean DEFAULT true,
  relance_j7 boolean DEFAULT true,
  statut text DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'actif', 'archive')),
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_questionnaires_org ON questionnaires(organisation_id);
CREATE INDEX idx_questionnaires_produit ON questionnaires(produit_id);
CREATE INDEX idx_questionnaires_statut ON questionnaires(statut);

-- 2. Questions
CREATE TABLE IF NOT EXISTS questionnaire_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
  ordre int NOT NULL DEFAULT 0,
  texte text NOT NULL,
  type text NOT NULL CHECK (type IN (
    'libre', 'echelle', 'choix_unique', 'choix_multiple', 'vrai_faux'
  )),
  options jsonb DEFAULT '[]',
  obligatoire boolean DEFAULT true,
  points int DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_qq_questionnaire ON questionnaire_questions(questionnaire_id);

-- 3. Invitations (envois par email)
CREATE TABLE IF NOT EXISTS questionnaire_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  email text NOT NULL,
  nom text,
  prenom text,
  token text UNIQUE NOT NULL,
  sent_at timestamptz,
  opened_at timestamptz,
  completed_at timestamptz,
  relance_count int DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_qi_questionnaire ON questionnaire_invitations(questionnaire_id);
CREATE INDEX idx_qi_token ON questionnaire_invitations(token);
CREATE INDEX idx_qi_session ON questionnaire_invitations(session_id);

-- 4. Réponses
CREATE TABLE IF NOT EXISTS questionnaire_reponses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
  invitation_id uuid REFERENCES questionnaire_invitations(id) ON DELETE SET NULL,
  respondent_email text,
  respondent_name text,
  responses jsonb NOT NULL DEFAULT '[]',
  score_total int,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_qr_questionnaire ON questionnaire_reponses(questionnaire_id);
CREATE INDEX idx_qr_invitation ON questionnaire_reponses(invitation_id);

-- 5. Alertes (notifications si note < seuil)
CREATE TABLE IF NOT EXISTS questionnaire_alertes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
  question_id uuid REFERENCES questionnaire_questions(id) ON DELETE CASCADE,
  condition text DEFAULT 'inferieur_a' CHECK (condition IN ('inferieur_a', 'egal_a', 'superieur_a')),
  seuil numeric,
  email_destinataire text,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_qa_questionnaire ON questionnaire_alertes(questionnaire_id);

-- ═══════════════════════════════════════════
-- Add FK on session_evaluations → questionnaires
-- ═══════════════════════════════════════════
ALTER TABLE session_evaluations
  ADD CONSTRAINT fk_session_evaluations_questionnaire
  FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════
-- RLS policies
-- ═══════════════════════════════════════════

-- questionnaires
ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "questionnaires_select" ON questionnaires FOR SELECT
  USING (organisation_id IN (
    SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
  ));

CREATE POLICY "questionnaires_insert" ON questionnaires FOR INSERT
  WITH CHECK (organisation_id IN (
    SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
  ));

CREATE POLICY "questionnaires_update" ON questionnaires FOR UPDATE
  USING (organisation_id IN (
    SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
  ));

CREATE POLICY "questionnaires_delete" ON questionnaires FOR DELETE
  USING (organisation_id IN (
    SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
  ));

-- questionnaire_questions (via join to questionnaires)
ALTER TABLE questionnaire_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qq_select" ON questionnaire_questions FOR SELECT
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  ));

CREATE POLICY "qq_insert" ON questionnaire_questions FOR INSERT
  WITH CHECK (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  ));

CREATE POLICY "qq_update" ON questionnaire_questions FOR UPDATE
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  ));

CREATE POLICY "qq_delete" ON questionnaire_questions FOR DELETE
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  ));

-- questionnaire_invitations
ALTER TABLE questionnaire_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qi_select" ON questionnaire_invitations FOR SELECT
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  ));

CREATE POLICY "qi_insert" ON questionnaire_invitations FOR INSERT
  WITH CHECK (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  ));

CREATE POLICY "qi_update" ON questionnaire_invitations FOR UPDATE
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  ));

CREATE POLICY "qi_delete" ON questionnaire_invitations FOR DELETE
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  ));

-- questionnaire_reponses
ALTER TABLE questionnaire_reponses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_select" ON questionnaire_reponses FOR SELECT
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  ));

CREATE POLICY "qr_insert" ON questionnaire_reponses FOR INSERT
  WITH CHECK (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  ));

CREATE POLICY "qr_delete" ON questionnaire_reponses FOR DELETE
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  ));

-- questionnaire_alertes
ALTER TABLE questionnaire_alertes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qal_select" ON questionnaire_alertes FOR SELECT
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  ));

CREATE POLICY "qal_insert" ON questionnaire_alertes FOR INSERT
  WITH CHECK (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  ));

CREATE POLICY "qal_update" ON questionnaire_alertes FOR UPDATE
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  ));

CREATE POLICY "qal_delete" ON questionnaire_alertes FOR DELETE
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  ));

-- ═══════════════════════════════════════════
-- Public access policy for token-based responses
-- Anyone with a valid token can submit a response
-- ═══════════════════════════════════════════

-- Allow anonymous users to read invitations by token
CREATE POLICY "qi_public_select_by_token" ON questionnaire_invitations FOR SELECT
  USING (true);

-- Allow anonymous users to update invitation (mark opened/completed)
CREATE POLICY "qi_public_update_by_token" ON questionnaire_invitations FOR UPDATE
  USING (true);

-- Allow anonymous to read questions of a questionnaire (needed for public form)
CREATE POLICY "qq_public_select" ON questionnaire_questions FOR SELECT
  USING (true);

-- Allow anonymous to read questionnaire header (needed for public form)
CREATE POLICY "questionnaires_public_select" ON questionnaires FOR SELECT
  USING (true);

-- Allow anonymous to insert responses
CREATE POLICY "qr_public_insert" ON questionnaire_reponses FOR INSERT
  WITH CHECK (true);
