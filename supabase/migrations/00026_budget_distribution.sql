-- ═══════════════════════════════════════════════════════════
-- Migration 00026: Budget Distribution per Agency
-- ═══════════════════════════════════════════════════════════
-- Changes:
-- 1. New table plan_budgets_agence (manual budget allocation per agency)
-- 2. Add seuil_alerte_pct to plans_formation (configurable alert threshold)
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════
-- 1. TABLE PLAN_BUDGETS_AGENCE
-- ═══════════════════════════════════════════

CREATE TABLE plan_budgets_agence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  plan_formation_id uuid NOT NULL REFERENCES plans_formation(id) ON DELETE CASCADE,
  agence_id uuid REFERENCES entreprise_agences(id) ON DELETE CASCADE, -- NULL = siège social
  budget_alloue numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  -- NOTE: uniqueness handled by index below (NULL-safe for siège)
);

-- Indexes
CREATE INDEX idx_plan_budgets_agence_organisation ON plan_budgets_agence(organisation_id);
CREATE INDEX idx_plan_budgets_agence_plan ON plan_budgets_agence(plan_formation_id);
CREATE INDEX idx_plan_budgets_agence_agence ON plan_budgets_agence(agence_id);

-- NULL-safe unique: one allocation per plan per agence (NULL agence_id = siège)
CREATE UNIQUE INDEX idx_plan_budgets_agence_unique
  ON plan_budgets_agence (plan_formation_id, COALESCE(agence_id, '00000000-0000-0000-0000-000000000000'));

-- RLS
ALTER TABLE plan_budgets_agence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_budgets_agence_select" ON plan_budgets_agence FOR SELECT
  USING (organisation_id = auth_organisation_id());
CREATE POLICY "plan_budgets_agence_insert" ON plan_budgets_agence FOR INSERT
  WITH CHECK (organisation_id = auth_organisation_id());
CREATE POLICY "plan_budgets_agence_update" ON plan_budgets_agence FOR UPDATE
  USING (organisation_id = auth_organisation_id());
CREATE POLICY "plan_budgets_agence_delete" ON plan_budgets_agence FOR DELETE
  USING (organisation_id = auth_organisation_id());

-- Trigger updated_at
CREATE TRIGGER set_plan_budgets_agence_updated_at
  BEFORE UPDATE ON plan_budgets_agence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════
-- 2. ALTER plans_formation — alert threshold
-- ═══════════════════════════════════════════

ALTER TABLE plans_formation
  ADD COLUMN IF NOT EXISTS seuil_alerte_pct int DEFAULT 80;
