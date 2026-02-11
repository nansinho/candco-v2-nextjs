-- ═══════════════════════════════════════════
-- Migration 00031: Fix Supabase security linter warnings
--
-- Fixes:
-- 1. function_search_path_mutable: update_updated_at
-- 2. rls_policy_always_true: apprenant_entreprise_agences (INSERT/DELETE)
-- 3. rls_policy_always_true: formateur_disponibilites (INSERT/UPDATE/DELETE)
-- 4. rls_policy_always_true: questionnaire_invitations (UPDATE)
-- 5. rls_policy_always_true: questionnaire_reponses (INSERT)
-- ═══════════════════════════════════════════

-- ═══════════════════════════════════════════
-- 1. Fix update_updated_at search_path
--    Re-apply SET search_path = '' (migration 00013 may not have been applied)
-- ═══════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════
-- 2. Fix apprenant_entreprise_agences RLS
--    Replace USING(true)/WITH CHECK(true) with proper org filtering
--    Join path: apprenant_entreprise_agences → apprenant_entreprises → apprenants → organisation_id
-- ═══════════════════════════════════════════

-- Drop the permissive policies
DROP POLICY IF EXISTS "apprenant_entreprise_agences_select" ON public.apprenant_entreprise_agences;
DROP POLICY IF EXISTS "apprenant_entreprise_agences_insert" ON public.apprenant_entreprise_agences;
DROP POLICY IF EXISTS "apprenant_entreprise_agences_delete" ON public.apprenant_entreprise_agences;

-- Create proper org-scoped policies
CREATE POLICY "apprenant_entreprise_agences_select"
  ON public.apprenant_entreprise_agences FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.apprenant_entreprises ae
      JOIN public.apprenants a ON a.id = ae.apprenant_id
      WHERE ae.id = apprenant_entreprise_agences.apprenant_entreprise_id
      AND a.organisation_id IN (
        SELECT organisation_id FROM public.utilisateurs WHERE id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "apprenant_entreprise_agences_insert"
  ON public.apprenant_entreprise_agences FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.apprenant_entreprises ae
      JOIN public.apprenants a ON a.id = ae.apprenant_id
      WHERE ae.id = apprenant_entreprise_agences.apprenant_entreprise_id
      AND a.organisation_id IN (
        SELECT organisation_id FROM public.utilisateurs WHERE id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "apprenant_entreprise_agences_delete"
  ON public.apprenant_entreprise_agences FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.apprenant_entreprises ae
      JOIN public.apprenants a ON a.id = ae.apprenant_id
      WHERE ae.id = apprenant_entreprise_agences.apprenant_entreprise_id
      AND a.organisation_id IN (
        SELECT organisation_id FROM public.utilisateurs WHERE id = (SELECT auth.uid())
      )
    )
  );

-- ═══════════════════════════════════════════
-- 3. Fix formateur_disponibilites RLS
--    Drop extra permissive policies added outside of migrations.
--    The FOR ALL policy "Users access own org disponibilites" (from 00029)
--    already covers SELECT/INSERT/UPDATE/DELETE with proper org filtering.
-- ═══════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated users can delete disponibilites" ON public.formateur_disponibilites;
DROP POLICY IF EXISTS "Authenticated users can insert disponibilites" ON public.formateur_disponibilites;
DROP POLICY IF EXISTS "Authenticated users can update disponibilites" ON public.formateur_disponibilites;

-- ═══════════════════════════════════════════
-- 4. Fix questionnaire_invitations public UPDATE policy
--    Replace unrestricted USING(true) with scoped conditions:
--    - USING: only non-completed invitations can be updated
--    - WITH CHECK: after update, opened_at must be set
--      (valid for both marking opened and marking completed)
-- ═══════════════════════════════════════════

DROP POLICY IF EXISTS "qi_public_update_by_token" ON public.questionnaire_invitations;

CREATE POLICY "qi_public_update_by_token"
  ON public.questionnaire_invitations FOR UPDATE
  USING (completed_at IS NULL)
  WITH CHECK (opened_at IS NOT NULL);

-- ═══════════════════════════════════════════
-- 5. Fix questionnaire_reponses public INSERT policy
--    Replace unrestricted WITH CHECK(true) with a condition:
--    - Require that the response is linked to a valid, non-completed invitation
--    (response is inserted before invitation is marked completed)
-- ═══════════════════════════════════════════

DROP POLICY IF EXISTS "qr_public_insert" ON public.questionnaire_reponses;

CREATE POLICY "qr_public_insert"
  ON public.questionnaire_reponses FOR INSERT
  WITH CHECK (
    invitation_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.questionnaire_invitations qi
      WHERE qi.id = invitation_id
      AND qi.completed_at IS NULL
    )
  );
