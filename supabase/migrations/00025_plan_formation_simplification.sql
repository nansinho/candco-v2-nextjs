-- ═══════════════════════════════════════════════════════════
-- Migration 00025: Simplification du Plan de Formation
-- ═══════════════════════════════════════════════════════════
-- Changes:
-- 1. Add siege_social boolean to besoins_formation
-- 2. Add agences_ids uuid[] for multi-agence support
-- 3. Consolidate all existing besoins to type_besoin = 'plan'
-- 4. Migrate existing agence_id into agences_ids array

-- Add new columns
ALTER TABLE besoins_formation
  ADD COLUMN IF NOT EXISTS siege_social boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS agences_ids uuid[] DEFAULT '{}';

-- Migrate existing single agence_id into agences_ids array
UPDATE besoins_formation
SET agences_ids = ARRAY[agence_id]
WHERE agence_id IS NOT NULL
  AND (agences_ids IS NULL OR agences_ids = '{}');

-- Consolidate: all existing besoins become 'plan' type
UPDATE besoins_formation
SET type_besoin = 'plan'
WHERE type_besoin = 'ponctuel'
  AND archived_at IS NULL;

-- Auto-link orphan plan-type besoins to their year's plan
-- (creates plans if missing, handled in application code)

-- Index for agences_ids (GIN for array containment queries)
CREATE INDEX IF NOT EXISTS idx_besoins_formation_agences_ids
  ON besoins_formation USING GIN (agences_ids);
