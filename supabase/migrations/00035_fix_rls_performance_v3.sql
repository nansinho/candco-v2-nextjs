-- ═══════════════════════════════════════════════════════════
-- Migration 00035: Fix RLS Performance v3
--
-- Fixes 2 categories of Supabase linter warnings:
--
-- PART 1: auth_rls_initplan (12 policies across 3 tables)
--   Replace raw auth.uid() with auth_organisation_id() helper,
--   consolidate 4 per-action policies into single FOR ALL policies.
--   Tables: produit_questionnaires, produit_questionnaire_planifications,
--           session_questionnaire_planifications
--
-- PART 2: multiple_permissive_policies (4 tables, 5 duplicate pairs)
--   Merge duplicate permissive policies (org-scoped + public-access)
--   into single policies using OR logic.
--   Tables: questionnaires, questionnaire_questions,
--           questionnaire_invitations, questionnaire_reponses
-- ═══════════════════════════════════════════════════════════


-- ───────────────────────────────────────────
-- PART 1: Fix auth_rls_initplan
-- Replace auth.uid() → auth_organisation_id()
-- Consolidate 4 policies → 1 FOR ALL
-- ───────────────────────────────────────────

-- 1a. produit_questionnaires → 1 FOR ALL via produits_formation join

DROP POLICY IF EXISTS "produit_questionnaires_select" ON produit_questionnaires;
DROP POLICY IF EXISTS "produit_questionnaires_insert" ON produit_questionnaires;
DROP POLICY IF EXISTS "produit_questionnaires_update" ON produit_questionnaires;
DROP POLICY IF EXISTS "produit_questionnaires_delete" ON produit_questionnaires;

CREATE POLICY "Access own org produit_questionnaires" ON produit_questionnaires
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM produits_formation pf
      WHERE pf.id = produit_questionnaires.produit_id
        AND pf.organisation_id = auth_organisation_id()
    )
  );

-- 1b. produit_questionnaire_planifications → 1 FOR ALL

DROP POLICY IF EXISTS "pqp_select" ON produit_questionnaire_planifications;
DROP POLICY IF EXISTS "pqp_insert" ON produit_questionnaire_planifications;
DROP POLICY IF EXISTS "pqp_update" ON produit_questionnaire_planifications;
DROP POLICY IF EXISTS "pqp_delete" ON produit_questionnaire_planifications;

CREATE POLICY "Access own org produit_questionnaire_planifications"
  ON produit_questionnaire_planifications
  FOR ALL USING (
    organisation_id = auth_organisation_id()
  );

-- 1c. session_questionnaire_planifications → 1 FOR ALL

DROP POLICY IF EXISTS "sqp_select" ON session_questionnaire_planifications;
DROP POLICY IF EXISTS "sqp_insert" ON session_questionnaire_planifications;
DROP POLICY IF EXISTS "sqp_update" ON session_questionnaire_planifications;
DROP POLICY IF EXISTS "sqp_delete" ON session_questionnaire_planifications;

CREATE POLICY "Access own org session_questionnaire_planifications"
  ON session_questionnaire_planifications
  FOR ALL USING (
    organisation_id = auth_organisation_id()
  );


-- ───────────────────────────────────────────
-- PART 2: Fix multiple_permissive_policies
-- Merge duplicate permissive policies into single policies.
--
-- Context: migration 00024 created org-scoped + public-access policies.
-- Migration 00031_v2 rewrote org-scoped policies but left public ones,
-- resulting in duplicates for the same role+action.
--
-- Note: authenticated extranet users (apprenants, formateurs) access
-- questionnaire forms via token links. auth_organisation_id() returns NULL
-- for them (not in utilisateurs table). The public-access path must remain
-- available to all roles, not just anon.
-- ───────────────────────────────────────────

-- 2a. questionnaires SELECT — merge org + public → USING(true)
--     org: organisation_id = auth_organisation_id()
--     public: USING(true)
--     Since (X OR true) = true, merged result is USING(true).
--     Write policies (INSERT/UPDATE/DELETE) still enforce org-scoping.

DROP POLICY IF EXISTS "questionnaires_select" ON questionnaires;
DROP POLICY IF EXISTS "questionnaires_public_select" ON questionnaires;

CREATE POLICY "questionnaires_select" ON questionnaires
  FOR SELECT USING (true);

-- 2b. questionnaire_questions SELECT — merge org + public → USING(true)

DROP POLICY IF EXISTS "qq_select" ON questionnaire_questions;
DROP POLICY IF EXISTS "qq_public_select" ON questionnaire_questions;

CREATE POLICY "qq_select" ON questionnaire_questions
  FOR SELECT USING (true);

-- 2c. questionnaire_invitations SELECT — merge org + public → USING(true)

DROP POLICY IF EXISTS "qi_select" ON questionnaire_invitations;
DROP POLICY IF EXISTS "qi_public_select_by_token" ON questionnaire_invitations;

CREATE POLICY "qi_select" ON questionnaire_invitations
  FOR SELECT USING (true);

-- 2d. questionnaire_invitations UPDATE — merge org + public conditions
--     org: questionnaire_id IN (SELECT id FROM questionnaires WHERE org = ...)
--     public: USING(completed_at IS NULL) WITH CHECK(opened_at IS NOT NULL)
--     Merged: org admin can update any, public can update non-completed.

DROP POLICY IF EXISTS "qi_update" ON questionnaire_invitations;
DROP POLICY IF EXISTS "qi_public_update_by_token" ON questionnaire_invitations;

CREATE POLICY "qi_update" ON questionnaire_invitations
  FOR UPDATE
  USING (
    questionnaire_id IN (
      SELECT id FROM questionnaires WHERE organisation_id = auth_organisation_id()
    )
    OR completed_at IS NULL
  )
  WITH CHECK (
    questionnaire_id IN (
      SELECT id FROM questionnaires WHERE organisation_id = auth_organisation_id()
    )
    OR opened_at IS NOT NULL
  );

-- 2e. questionnaire_reponses INSERT — merge org + public conditions
--     org: questionnaire_id IN (SELECT id FROM questionnaires WHERE org = ...)
--     public: invitation_id IS NOT NULL AND EXISTS(valid non-completed invitation)
--     Merged: org admin can insert for their org, public needs valid invitation.

DROP POLICY IF EXISTS "qr_insert" ON questionnaire_reponses;
DROP POLICY IF EXISTS "qr_public_insert" ON questionnaire_reponses;

CREATE POLICY "qr_insert" ON questionnaire_reponses
  FOR INSERT
  WITH CHECK (
    questionnaire_id IN (
      SELECT id FROM questionnaires WHERE organisation_id = auth_organisation_id()
    )
    OR (
      invitation_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM questionnaire_invitations qi
        WHERE qi.id = invitation_id
          AND qi.completed_at IS NULL
      )
    )
  );
