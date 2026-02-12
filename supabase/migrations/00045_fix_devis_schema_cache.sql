-- ═══════════════════════════════════════════
-- Migration 00045: Fix devis particulier_telephone schema cache
--
-- Defensive migration to ensure:
-- 1. The particulier_telephone column exists on the devis table
-- 2. PostgREST DDL event trigger is in place
-- 3. Schema cache is explicitly reloaded
-- ═══════════════════════════════════════════

-- 1. Ensure the column exists (idempotent — no-op if already present)
ALTER TABLE devis ADD COLUMN IF NOT EXISTS particulier_telephone text;

-- 2. Re-create the DDL event trigger function (from migration 00038, safe if already exists)
CREATE OR REPLACE FUNCTION public.pgrst_ddl_watch()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
END;
$$;

-- 3. Re-create event triggers (idempotent via DROP IF EXISTS)
DROP EVENT TRIGGER IF EXISTS pgrst_ddl_watch;
CREATE EVENT TRIGGER pgrst_ddl_watch
  ON ddl_command_end
  EXECUTE FUNCTION public.pgrst_ddl_watch();

DROP EVENT TRIGGER IF EXISTS pgrst_drop_watch;
CREATE EVENT TRIGGER pgrst_drop_watch
  ON sql_drop
  EXECUTE FUNCTION public.pgrst_ddl_watch();

-- 4. Force immediate schema cache reload
NOTIFY pgrst, 'reload schema';
