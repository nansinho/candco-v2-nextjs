-- Migration: Convert member single role to multi-roles array
-- Also relaxes constraint to allow members without contact_client_id

-- Step 1: Add new roles column (array)
ALTER TABLE entreprise_membres
  ADD COLUMN IF NOT EXISTS roles text[] NOT NULL DEFAULT '{employe}'::text[];

-- Step 2: Migrate existing data from single role to array
UPDATE entreprise_membres
  SET roles = ARRAY[role]
  WHERE role IS NOT NULL AND roles = '{employe}'::text[];

-- Step 3: Drop old single role column
ALTER TABLE entreprise_membres DROP COLUMN IF EXISTS role;

-- Step 4: Relax constraint - only apprenant_id is required now (contacts are legacy)
ALTER TABLE entreprise_membres DROP CONSTRAINT IF EXISTS check_membre_link;
ALTER TABLE entreprise_membres
  ADD CONSTRAINT check_membre_link CHECK (apprenant_id IS NOT NULL OR contact_client_id IS NOT NULL);
