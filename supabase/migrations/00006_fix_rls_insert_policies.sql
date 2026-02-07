-- ═══════════════════════════════════════════
-- Migration 00006: Fix RLS policies for INSERT on org structure tables
--
-- The previous FOR ALL USING(...) policy doesn't properly grant INSERT
-- because the USING clause can fail when PostgREST tries to read back
-- the newly inserted row. We split into explicit SELECT + INSERT + UPDATE + DELETE policies.
-- ═══════════════════════════════════════════

-- ─── entreprise_agences ─────────────────────────────────

-- Drop the old single policy
DROP POLICY IF EXISTS "Access through entreprise" ON entreprise_agences;

-- SELECT: can read agences of enterprises in my organisation
CREATE POLICY "agences_select" ON entreprise_agences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = entreprise_agences.entreprise_id
      AND organisation_id = (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

-- INSERT: can insert agences for enterprises in my organisation
CREATE POLICY "agences_insert" ON entreprise_agences
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = entreprise_agences.entreprise_id
      AND organisation_id = (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

-- UPDATE: can update agences of enterprises in my organisation
CREATE POLICY "agences_update" ON entreprise_agences
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = entreprise_agences.entreprise_id
      AND organisation_id = (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

-- DELETE: can delete agences of enterprises in my organisation
CREATE POLICY "agences_delete" ON entreprise_agences
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = entreprise_agences.entreprise_id
      AND organisation_id = (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

-- ─── entreprise_poles ───────────────────────────────────

DROP POLICY IF EXISTS "Access through entreprise" ON entreprise_poles;

CREATE POLICY "poles_select" ON entreprise_poles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = entreprise_poles.entreprise_id
      AND organisation_id = (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "poles_insert" ON entreprise_poles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = entreprise_poles.entreprise_id
      AND organisation_id = (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "poles_update" ON entreprise_poles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = entreprise_poles.entreprise_id
      AND organisation_id = (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "poles_delete" ON entreprise_poles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = entreprise_poles.entreprise_id
      AND organisation_id = (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

-- ─── entreprise_membres ─────────────────────────────────

DROP POLICY IF EXISTS "Access through entreprise" ON entreprise_membres;

CREATE POLICY "membres_select" ON entreprise_membres
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = entreprise_membres.entreprise_id
      AND organisation_id = (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "membres_insert" ON entreprise_membres
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = entreprise_membres.entreprise_id
      AND organisation_id = (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "membres_update" ON entreprise_membres
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = entreprise_membres.entreprise_id
      AND organisation_id = (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "membres_delete" ON entreprise_membres
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = entreprise_membres.entreprise_id
      AND organisation_id = (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );
