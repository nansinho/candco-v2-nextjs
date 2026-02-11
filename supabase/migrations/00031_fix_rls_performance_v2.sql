-- ═══════════════════════════════════════════════════════════
-- Migration 00031: Fix RLS Performance v2
--
-- Fixes 3 categories of Supabase linter warnings:
-- 1. auth_rls_initplan — wrap auth.uid() in (select ...) via auth_organisation_id()
-- 2. multiple_permissive_policies — drop duplicate policies from migration 00018
--    that were superseded by 00028
-- 3. duplicate_index — drop duplicate indexes (same column, different names)
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────
-- PART 1: Drop duplicate policies from 00018
-- (superseded by "Org isolation *" from 00028)
-- ───────────────────────────────────────────

-- 1a. opportunites — drop individual policies, keep "Org isolation *"
DROP POLICY IF EXISTS "opportunites_select" ON opportunites;
DROP POLICY IF EXISTS "opportunites_insert" ON opportunites;
DROP POLICY IF EXISTS "opportunites_update" ON opportunites;
DROP POLICY IF EXISTS "opportunites_delete" ON opportunites;

-- 1b. devis — drop individual policies, keep "Org isolation *"
DROP POLICY IF EXISTS "devis_select" ON devis;
DROP POLICY IF EXISTS "devis_insert" ON devis;
DROP POLICY IF EXISTS "devis_update" ON devis;
DROP POLICY IF EXISTS "devis_delete" ON devis;

-- 1c. factures — drop individual policies, keep "Org isolation *"
DROP POLICY IF EXISTS "factures_select" ON factures;
DROP POLICY IF EXISTS "factures_insert" ON factures;
DROP POLICY IF EXISTS "factures_update" ON factures;
DROP POLICY IF EXISTS "factures_delete" ON factures;

-- 1d. avoirs — drop individual policies, keep "Org isolation *"
DROP POLICY IF EXISTS "avoirs_select" ON avoirs;
DROP POLICY IF EXISTS "avoirs_insert" ON avoirs;
DROP POLICY IF EXISTS "avoirs_update" ON avoirs;
DROP POLICY IF EXISTS "avoirs_delete" ON avoirs;

-- 1e. devis_lignes — drop individual policies, keep "Access through devis"
DROP POLICY IF EXISTS "devis_lignes_select" ON devis_lignes;
DROP POLICY IF EXISTS "devis_lignes_insert" ON devis_lignes;
DROP POLICY IF EXISTS "devis_lignes_update" ON devis_lignes;
DROP POLICY IF EXISTS "devis_lignes_delete" ON devis_lignes;

-- 1f. facture_lignes — drop individual policies, keep "Access through facture"
DROP POLICY IF EXISTS "facture_lignes_select" ON facture_lignes;
DROP POLICY IF EXISTS "facture_lignes_insert" ON facture_lignes;
DROP POLICY IF EXISTS "facture_lignes_update" ON facture_lignes;
DROP POLICY IF EXISTS "facture_lignes_delete" ON facture_lignes;

-- 1g. facture_paiements — drop individual policies, keep "Access through facture paiement"
DROP POLICY IF EXISTS "facture_paiements_select" ON facture_paiements;
DROP POLICY IF EXISTS "facture_paiements_insert" ON facture_paiements;
DROP POLICY IF EXISTS "facture_paiements_update" ON facture_paiements;
DROP POLICY IF EXISTS "facture_paiements_delete" ON facture_paiements;

-- 1h. avoir_lignes — drop individual policies, keep "Access through avoir"
DROP POLICY IF EXISTS "avoir_lignes_select" ON avoir_lignes;
DROP POLICY IF EXISTS "avoir_lignes_insert" ON avoir_lignes;
DROP POLICY IF EXISTS "avoir_lignes_update" ON avoir_lignes;
DROP POLICY IF EXISTS "avoir_lignes_delete" ON avoir_lignes;

-- 1i. entreprise_agences — drop individual policies, keep "Access through entreprise"
DROP POLICY IF EXISTS "agences_select" ON entreprise_agences;
DROP POLICY IF EXISTS "agences_insert" ON entreprise_agences;
DROP POLICY IF EXISTS "agences_update" ON entreprise_agences;
DROP POLICY IF EXISTS "agences_delete" ON entreprise_agences;

-- 1j. entreprise_poles — drop individual policies, keep "Access through entreprise"
DROP POLICY IF EXISTS "poles_select" ON entreprise_poles;
DROP POLICY IF EXISTS "poles_insert" ON entreprise_poles;
DROP POLICY IF EXISTS "poles_update" ON entreprise_poles;
DROP POLICY IF EXISTS "poles_delete" ON entreprise_poles;

-- 1k. entreprise_membres — drop individual policies, keep "Access through entreprise"
DROP POLICY IF EXISTS "membres_select" ON entreprise_membres;
DROP POLICY IF EXISTS "membres_insert" ON entreprise_membres;
DROP POLICY IF EXISTS "membres_update" ON entreprise_membres;
DROP POLICY IF EXISTS "membres_delete" ON entreprise_membres;

-- ───────────────────────────────────────────
-- PART 2: Fix auth_rls_initplan
-- Replace auth.uid() with (select auth.uid()) via auth_organisation_id()
-- ───────────────────────────────────────────

-- 2a. historique_events — replace inline subquery with auth_organisation_id()

DROP POLICY IF EXISTS "historique_events_select" ON historique_events;
CREATE POLICY "historique_events_select" ON historique_events
  FOR SELECT USING (
    organisation_id = auth_organisation_id()
  );

DROP POLICY IF EXISTS "historique_events_insert" ON historique_events;
CREATE POLICY "historique_events_insert" ON historique_events
  FOR INSERT WITH CHECK (
    organisation_id = auth_organisation_id()
  );

-- 2b. questionnaires — replace inline subquery with auth_organisation_id()

DROP POLICY IF EXISTS "questionnaires_select" ON questionnaires;
CREATE POLICY "questionnaires_select" ON questionnaires FOR SELECT
  USING (organisation_id = auth_organisation_id());

DROP POLICY IF EXISTS "questionnaires_insert" ON questionnaires;
CREATE POLICY "questionnaires_insert" ON questionnaires FOR INSERT
  WITH CHECK (organisation_id = auth_organisation_id());

DROP POLICY IF EXISTS "questionnaires_update" ON questionnaires;
CREATE POLICY "questionnaires_update" ON questionnaires FOR UPDATE
  USING (organisation_id = auth_organisation_id());

DROP POLICY IF EXISTS "questionnaires_delete" ON questionnaires;
CREATE POLICY "questionnaires_delete" ON questionnaires FOR DELETE
  USING (organisation_id = auth_organisation_id());

-- 2c. questionnaire_questions — optimize join via auth_organisation_id()

DROP POLICY IF EXISTS "qq_select" ON questionnaire_questions;
CREATE POLICY "qq_select" ON questionnaire_questions FOR SELECT
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id = auth_organisation_id()
  ));

DROP POLICY IF EXISTS "qq_insert" ON questionnaire_questions;
CREATE POLICY "qq_insert" ON questionnaire_questions FOR INSERT
  WITH CHECK (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id = auth_organisation_id()
  ));

DROP POLICY IF EXISTS "qq_update" ON questionnaire_questions;
CREATE POLICY "qq_update" ON questionnaire_questions FOR UPDATE
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id = auth_organisation_id()
  ));

DROP POLICY IF EXISTS "qq_delete" ON questionnaire_questions;
CREATE POLICY "qq_delete" ON questionnaire_questions FOR DELETE
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id = auth_organisation_id()
  ));

-- 2d. questionnaire_invitations — optimize join via auth_organisation_id()

DROP POLICY IF EXISTS "qi_select" ON questionnaire_invitations;
CREATE POLICY "qi_select" ON questionnaire_invitations FOR SELECT
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id = auth_organisation_id()
  ));

DROP POLICY IF EXISTS "qi_insert" ON questionnaire_invitations;
CREATE POLICY "qi_insert" ON questionnaire_invitations FOR INSERT
  WITH CHECK (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id = auth_organisation_id()
  ));

DROP POLICY IF EXISTS "qi_update" ON questionnaire_invitations;
CREATE POLICY "qi_update" ON questionnaire_invitations FOR UPDATE
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id = auth_organisation_id()
  ));

DROP POLICY IF EXISTS "qi_delete" ON questionnaire_invitations;
CREATE POLICY "qi_delete" ON questionnaire_invitations FOR DELETE
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id = auth_organisation_id()
  ));

-- 2e. questionnaire_reponses — optimize join via auth_organisation_id()

DROP POLICY IF EXISTS "qr_select" ON questionnaire_reponses;
CREATE POLICY "qr_select" ON questionnaire_reponses FOR SELECT
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id = auth_organisation_id()
  ));

DROP POLICY IF EXISTS "qr_insert" ON questionnaire_reponses;
CREATE POLICY "qr_insert" ON questionnaire_reponses FOR INSERT
  WITH CHECK (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id = auth_organisation_id()
  ));

DROP POLICY IF EXISTS "qr_delete" ON questionnaire_reponses;
CREATE POLICY "qr_delete" ON questionnaire_reponses FOR DELETE
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id = auth_organisation_id()
  ));

-- 2f. questionnaire_alertes — optimize join via auth_organisation_id()

DROP POLICY IF EXISTS "qal_select" ON questionnaire_alertes;
CREATE POLICY "qal_select" ON questionnaire_alertes FOR SELECT
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id = auth_organisation_id()
  ));

DROP POLICY IF EXISTS "qal_insert" ON questionnaire_alertes;
CREATE POLICY "qal_insert" ON questionnaire_alertes FOR INSERT
  WITH CHECK (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id = auth_organisation_id()
  ));

DROP POLICY IF EXISTS "qal_update" ON questionnaire_alertes;
CREATE POLICY "qal_update" ON questionnaire_alertes FOR UPDATE
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id = auth_organisation_id()
  ));

DROP POLICY IF EXISTS "qal_delete" ON questionnaire_alertes;
CREATE POLICY "qal_delete" ON questionnaire_alertes FOR DELETE
  USING (questionnaire_id IN (
    SELECT id FROM questionnaires WHERE organisation_id = auth_organisation_id()
  ));

-- 2g. tickets — use auth_organisation_id() + (select auth.uid())

DROP POLICY IF EXISTS "tickets_select" ON tickets;
CREATE POLICY "tickets_select" ON tickets FOR SELECT
  USING (
    organisation_id = auth_organisation_id()
    OR auteur_user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "tickets_insert" ON tickets;
CREATE POLICY "tickets_insert" ON tickets FOR INSERT
  WITH CHECK (
    organisation_id = auth_organisation_id()
    OR auteur_user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "tickets_update" ON tickets;
CREATE POLICY "tickets_update" ON tickets FOR UPDATE
  USING (
    organisation_id = auth_organisation_id()
    OR auteur_user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "tickets_delete" ON tickets;
CREATE POLICY "tickets_delete" ON tickets FOR DELETE
  USING (
    organisation_id = auth_organisation_id()
  );

-- 2h. ticket_messages — optimize via auth_organisation_id() + (select auth.uid())

DROP POLICY IF EXISTS "tm_select" ON ticket_messages;
CREATE POLICY "tm_select" ON ticket_messages FOR SELECT
  USING (ticket_id IN (
    SELECT id FROM tickets WHERE
      organisation_id = auth_organisation_id()
      OR auteur_user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "tm_insert" ON ticket_messages;
CREATE POLICY "tm_insert" ON ticket_messages FOR INSERT
  WITH CHECK (ticket_id IN (
    SELECT id FROM tickets WHERE
      organisation_id = auth_organisation_id()
      OR auteur_user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "tm_delete" ON ticket_messages;
CREATE POLICY "tm_delete" ON ticket_messages FOR DELETE
  USING (ticket_id IN (
    SELECT id FROM tickets WHERE
      organisation_id = auth_organisation_id()
  ));

-- 2i. ticket_mentions — optimize via auth_organisation_id() + (select auth.uid())

DROP POLICY IF EXISTS "tmen_select" ON ticket_mentions;
CREATE POLICY "tmen_select" ON ticket_mentions FOR SELECT
  USING (ticket_id IN (
    SELECT id FROM tickets WHERE
      organisation_id = auth_organisation_id()
      OR auteur_user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "tmen_insert" ON ticket_mentions;
CREATE POLICY "tmen_insert" ON ticket_mentions FOR INSERT
  WITH CHECK (ticket_id IN (
    SELECT id FROM tickets WHERE
      organisation_id = auth_organisation_id()
      OR auteur_user_id = (select auth.uid())
  ));

-- 2j. ticket_historique — optimize via auth_organisation_id() + (select auth.uid())

DROP POLICY IF EXISTS "th_select" ON ticket_historique;
CREATE POLICY "th_select" ON ticket_historique FOR SELECT
  USING (ticket_id IN (
    SELECT id FROM tickets WHERE
      organisation_id = auth_organisation_id()
      OR auteur_user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "th_insert" ON ticket_historique;
CREATE POLICY "th_insert" ON ticket_historique FOR INSERT
  WITH CHECK (ticket_id IN (
    SELECT id FROM tickets WHERE
      organisation_id = auth_organisation_id()
      OR auteur_user_id = (select auth.uid())
  ));

-- ───────────────────────────────────────────
-- PART 3: Drop duplicate indexes
-- (00018 created *_organisation, 00028 created *_org)
-- ───────────────────────────────────────────

DROP INDEX IF EXISTS idx_avoirs_organisation;
DROP INDEX IF EXISTS idx_devis_organisation;
DROP INDEX IF EXISTS idx_factures_organisation;
DROP INDEX IF EXISTS idx_opportunites_organisation;
