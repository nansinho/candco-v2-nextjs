-- Migration: Add tarif_id to besoins_formation
-- Allows storing the specific tariff chosen for each formation need,
-- instead of always using the default tariff for budget calculations.

-- 1. Add the column
ALTER TABLE besoins_formation
  ADD COLUMN tarif_id uuid REFERENCES produit_tarifs(id) ON DELETE SET NULL;

-- 2. Index for efficient joins in budget calculations
CREATE INDEX idx_besoins_formation_tarif ON besoins_formation(tarif_id);

-- 3. Backfill existing rows with their product's default tariff
UPDATE besoins_formation bf
SET tarif_id = pt.id
FROM produit_tarifs pt
WHERE bf.produit_id = pt.produit_id
  AND pt.is_default = true
  AND bf.tarif_id IS NULL
  AND bf.produit_id IS NOT NULL;
