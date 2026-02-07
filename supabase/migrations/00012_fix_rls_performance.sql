-- Migration 00012: Fix RLS security + performance
--
-- 1. Enable RLS on 3 reference tables (bpf_categories_apprenant, bpf_categories_entreprise, bpf_specialites)
-- 2. Optimize auth_organisation_id() with (select auth.uid())
-- 3. Rewrite all policies using auth.uid() → (select auth.uid()) for performance
-- 4. Consolidate multiple permissive SELECT policies on extranet_acces & user_organisations
-- 5. Consolidate salles & sessions 4-policy pattern → 1 FOR ALL policy

-- ═══════════════════════════════════════════
-- 1. RLS sur les tables de référence
-- ═══════════════════════════════════════════

-- bpf_categories_apprenant
ALTER TABLE bpf_categories_apprenant ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON bpf_categories_apprenant
  FOR SELECT TO authenticated USING (true);

-- bpf_categories_entreprise
ALTER TABLE bpf_categories_entreprise ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON bpf_categories_entreprise
  FOR SELECT TO authenticated USING (true);

-- bpf_specialites
ALTER TABLE bpf_specialites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON bpf_specialites
  FOR SELECT TO authenticated USING (true);

-- ═══════════════════════════════════════════
-- 2. Optimiser auth_organisation_id()
-- ═══════════════════════════════════════════

CREATE OR REPLACE FUNCTION auth_organisation_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organisation_id FROM utilisateurs WHERE id = (select auth.uid())
$$;

-- ═══════════════════════════════════════════
-- 3. entreprise_agences — rewrite with auth_organisation_id()
-- ═══════════════════════════════════════════

DROP POLICY IF EXISTS "Access through entreprise" ON entreprise_agences;
CREATE POLICY "Access through entreprise" ON entreprise_agences
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = entreprise_id
      AND organisation_id = auth_organisation_id()
    )
  );

-- ═══════════════════════════════════════════
-- 4. entreprise_poles — rewrite with auth_organisation_id()
-- ═══════════════════════════════════════════

DROP POLICY IF EXISTS "Access through entreprise" ON entreprise_poles;
CREATE POLICY "Access through entreprise" ON entreprise_poles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = entreprise_id
      AND organisation_id = auth_organisation_id()
    )
  );

-- ═══════════════════════════════════════════
-- 5. entreprise_membres — rewrite with auth_organisation_id()
-- ═══════════════════════════════════════════

DROP POLICY IF EXISTS "Access through entreprise" ON entreprise_membres;
CREATE POLICY "Access through entreprise" ON entreprise_membres
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = entreprise_id
      AND organisation_id = auth_organisation_id()
    )
  );

-- ═══════════════════════════════════════════
-- 6. membre_agences — rewrite with auth_organisation_id()
-- ═══════════════════════════════════════════

DROP POLICY IF EXISTS "Access through membre" ON membre_agences;
CREATE POLICY "Access through membre" ON membre_agences
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM entreprise_membres em
      JOIN entreprises e ON e.id = em.entreprise_id
      WHERE em.id = membre_id
      AND e.organisation_id = auth_organisation_id()
    )
  );

-- ═══════════════════════════════════════════
-- 7. fonctions_predefinies — rewrite with auth_organisation_id()
-- ═══════════════════════════════════════════

DROP POLICY IF EXISTS "Access own org fonctions" ON fonctions_predefinies;
CREATE POLICY "Access own org fonctions" ON fonctions_predefinies
  FOR ALL USING (
    organisation_id = auth_organisation_id()
  );

-- ═══════════════════════════════════════════
-- 8. salles — consolidate 4 policies → 1 FOR ALL
-- ═══════════════════════════════════════════

DROP POLICY IF EXISTS "salles_select" ON salles;
DROP POLICY IF EXISTS "salles_insert" ON salles;
DROP POLICY IF EXISTS "salles_update" ON salles;
DROP POLICY IF EXISTS "salles_delete" ON salles;

CREATE POLICY "Access own org salles" ON salles
  FOR ALL USING (
    organisation_id = auth_organisation_id()
  );

-- ═══════════════════════════════════════════
-- 9. sessions — consolidate 4 policies → 1 FOR ALL
-- ═══════════════════════════════════════════

DROP POLICY IF EXISTS "sessions_select" ON sessions;
DROP POLICY IF EXISTS "sessions_insert" ON sessions;
DROP POLICY IF EXISTS "sessions_update" ON sessions;
DROP POLICY IF EXISTS "sessions_delete" ON sessions;

CREATE POLICY "Access own org sessions" ON sessions
  FOR ALL USING (
    organisation_id = auth_organisation_id()
  );

-- ═══════════════════════════════════════════
-- 10. utilisateurs — fix auth.uid() → (select auth.uid())
-- ═══════════════════════════════════════════

DROP POLICY IF EXISTS "Users can update their own profile" ON utilisateurs;
CREATE POLICY "Users can update their own profile" ON utilisateurs
  FOR UPDATE USING (
    id = (select auth.uid())
  );

-- ═══════════════════════════════════════════
-- 11. extranet_acces — merge 2 SELECT policies + fix auth.uid()
-- ═══════════════════════════════════════════

-- Drop old SELECT policies (will be merged)
DROP POLICY IF EXISTS "extranet_acces_select_own" ON extranet_acces;
DROP POLICY IF EXISTS "extranet_acces_select_org" ON extranet_acces;

-- Merged SELECT: user sees own access OR all access in their org
CREATE POLICY "extranet_acces_select" ON extranet_acces
  FOR SELECT USING (
    user_id = (select auth.uid())
    OR organisation_id = auth_organisation_id()
  );

-- Fix INSERT/UPDATE/DELETE to use (select auth.uid())
DROP POLICY IF EXISTS "extranet_acces_insert" ON extranet_acces;
CREATE POLICY "extranet_acces_insert" ON extranet_acces
  FOR INSERT WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs
      WHERE id = (select auth.uid()) AND role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "extranet_acces_update" ON extranet_acces;
CREATE POLICY "extranet_acces_update" ON extranet_acces
  FOR UPDATE USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs
      WHERE id = (select auth.uid()) AND role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "extranet_acces_delete" ON extranet_acces;
CREATE POLICY "extranet_acces_delete" ON extranet_acces
  FOR DELETE USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs
      WHERE id = (select auth.uid()) AND role = 'admin'
    )
  );

-- ═══════════════════════════════════════════
-- 12. user_organisations — merge 2 SELECT policies + fix auth.uid()
-- ═══════════════════════════════════════════

-- Drop old SELECT policies (will be merged)
DROP POLICY IF EXISTS "user_organisations_select_own" ON user_organisations;
DROP POLICY IF EXISTS "user_organisations_select_superadmin" ON user_organisations;

-- Merged SELECT: user sees own orgs OR super-admin sees all
CREATE POLICY "user_organisations_select" ON user_organisations
  FOR SELECT USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE id = (select auth.uid()) AND is_super_admin = true
    )
  );

-- Fix INSERT/UPDATE/DELETE to use (select auth.uid())
DROP POLICY IF EXISTS "user_organisations_insert" ON user_organisations;
CREATE POLICY "user_organisations_insert" ON user_organisations
  FOR INSERT WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs
      WHERE id = (select auth.uid()) AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE id = (select auth.uid()) AND is_super_admin = true
    )
  );

DROP POLICY IF EXISTS "user_organisations_update" ON user_organisations;
CREATE POLICY "user_organisations_update" ON user_organisations
  FOR UPDATE USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs
      WHERE id = (select auth.uid()) AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE id = (select auth.uid()) AND is_super_admin = true
    )
  );

DROP POLICY IF EXISTS "user_organisations_delete" ON user_organisations;
CREATE POLICY "user_organisations_delete" ON user_organisations
  FOR DELETE USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs
      WHERE id = (select auth.uid()) AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE id = (select auth.uid()) AND is_super_admin = true
    )
  );
