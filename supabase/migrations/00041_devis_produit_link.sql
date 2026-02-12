-- Migration 00041: Link devis to produits_formation + structured formation metadata
-- Connects each devis directly to a product from the catalog
-- Adds structured designation fields for formation details

-- A. Add produit_id FK on devis
ALTER TABLE devis
  ADD COLUMN IF NOT EXISTS produit_id uuid REFERENCES produits_formation(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_devis_produit ON devis(produit_id);

-- B. Add structured formation metadata on devis
ALTER TABLE devis
  ADD COLUMN IF NOT EXISTS lieu_formation text,
  ADD COLUMN IF NOT EXISTS dates_formation text,
  ADD COLUMN IF NOT EXISTS nombre_participants int,
  ADD COLUMN IF NOT EXISTS modalite_pedagogique text,
  ADD COLUMN IF NOT EXISTS duree_formation text;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
