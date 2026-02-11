-- ═══════════════════════════════════════════════════════════
-- Migration: Questionnaire Auto-Scheduling (Planifications)
-- ═══════════════════════════════════════════════════════════
--
-- Two tables:
--   1. produit_questionnaire_planifications — Scheduling rules at product level
--   2. session_questionnaire_planifications — Scheduling instances at session level
--
-- The product defines the rules; the session inherits and calculates dates.

-- ═══════════════════════════════════════════
-- 1. Product-level scheduling rules
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS produit_questionnaire_planifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  questionnaire_id uuid NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
  envoi_auto boolean NOT NULL DEFAULT false,
  declencheur text NOT NULL DEFAULT 'apres_fin'
    CHECK (declencheur IN ('avant_debut', 'apres_debut', 'apres_fin')),
  delai_jours integer NOT NULL DEFAULT 0,
  heure_envoi time NOT NULL DEFAULT '09:00',
  jours_ouvres_uniquement boolean NOT NULL DEFAULT false,
  repli_weekend text NOT NULL DEFAULT 'lundi_suivant'
    CHECK (repli_weekend IN ('vendredi_precedent', 'lundi_suivant')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (questionnaire_id)
);

-- Indexes
CREATE INDEX idx_pqp_organisation ON produit_questionnaire_planifications(organisation_id);
CREATE INDEX idx_pqp_questionnaire ON produit_questionnaire_planifications(questionnaire_id);

-- RLS
ALTER TABLE produit_questionnaire_planifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pqp_select" ON produit_questionnaire_planifications
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  );

CREATE POLICY "pqp_insert" ON produit_questionnaire_planifications
  FOR INSERT WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  );

CREATE POLICY "pqp_update" ON produit_questionnaire_planifications
  FOR UPDATE USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  );

CREATE POLICY "pqp_delete" ON produit_questionnaire_planifications
  FOR DELETE USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════
-- 2. Session-level scheduling instances
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS session_questionnaire_planifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  session_evaluation_id uuid NOT NULL REFERENCES session_evaluations(id) ON DELETE CASCADE,
  questionnaire_id uuid NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
  -- Scheduling config (copied from product or set manually)
  envoi_auto boolean NOT NULL DEFAULT true,
  declencheur text NOT NULL DEFAULT 'apres_fin'
    CHECK (declencheur IN ('avant_debut', 'apres_debut', 'apres_fin')),
  delai_jours integer NOT NULL DEFAULT 0,
  heure_envoi time NOT NULL DEFAULT '09:00',
  jours_ouvres_uniquement boolean NOT NULL DEFAULT false,
  repli_weekend text NOT NULL DEFAULT 'lundi_suivant'
    CHECK (repli_weekend IN ('vendredi_precedent', 'lundi_suivant')),
  -- Computed send date/time
  date_envoi_calculee timestamptz,
  -- Status tracking
  statut text NOT NULL DEFAULT 'a_programmer'
    CHECK (statut IN ('a_programmer', 'programme', 'envoye', 'annule', 'erreur')),
  -- Inheritance tracking
  herite_du_produit boolean NOT NULL DEFAULT false,
  personnalise boolean NOT NULL DEFAULT false,
  -- Execution tracking
  envoye_le timestamptz,
  erreur_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_evaluation_id)
);

-- Indexes
CREATE INDEX idx_sqp_organisation ON session_questionnaire_planifications(organisation_id);
CREATE INDEX idx_sqp_session ON session_questionnaire_planifications(session_id);
CREATE INDEX idx_sqp_questionnaire ON session_questionnaire_planifications(questionnaire_id);
CREATE INDEX idx_sqp_statut ON session_questionnaire_planifications(statut);
CREATE INDEX idx_sqp_date_envoi ON session_questionnaire_planifications(date_envoi_calculee)
  WHERE statut = 'programme' AND envoi_auto = true;

-- RLS
ALTER TABLE session_questionnaire_planifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sqp_select" ON session_questionnaire_planifications
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  );

CREATE POLICY "sqp_insert" ON session_questionnaire_planifications
  FOR INSERT WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  );

CREATE POLICY "sqp_update" ON session_questionnaire_planifications
  FOR UPDATE USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  );

CREATE POLICY "sqp_delete" ON session_questionnaire_planifications
  FOR DELETE USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════
-- 3. Helper function: calculate send date
-- ═══════════════════════════════════════════

CREATE OR REPLACE FUNCTION calculate_planification_date(
  p_declencheur text,
  p_delai_jours integer,
  p_heure_envoi time,
  p_jours_ouvres boolean,
  p_repli_weekend text,
  p_date_debut date,
  p_date_fin date
) RETURNS timestamptz
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  v_base_date date;
  v_result_date date;
  v_dow integer;
BEGIN
  -- Determine base date from trigger
  CASE p_declencheur
    WHEN 'avant_debut' THEN
      IF p_date_debut IS NULL THEN RETURN NULL; END IF;
      v_base_date := p_date_debut - p_delai_jours;
    WHEN 'apres_debut' THEN
      IF p_date_debut IS NULL THEN RETURN NULL; END IF;
      v_base_date := p_date_debut + p_delai_jours;
    WHEN 'apres_fin' THEN
      IF p_date_fin IS NULL THEN RETURN NULL; END IF;
      v_base_date := p_date_fin + p_delai_jours;
    ELSE
      RETURN NULL;
  END CASE;

  v_result_date := v_base_date;

  -- Handle business days / weekend fallback
  IF p_jours_ouvres THEN
    v_dow := EXTRACT(DOW FROM v_result_date);
    IF v_dow = 0 THEN -- Sunday
      IF p_repli_weekend = 'vendredi_precedent' THEN
        v_result_date := v_result_date - 2;
      ELSE -- lundi_suivant
        v_result_date := v_result_date + 1;
      END IF;
    ELSIF v_dow = 6 THEN -- Saturday
      IF p_repli_weekend = 'vendredi_precedent' THEN
        v_result_date := v_result_date - 1;
      ELSE -- lundi_suivant
        v_result_date := v_result_date + 2;
      END IF;
    END IF;
  END IF;

  RETURN v_result_date + p_heure_envoi;
END;
$$;
