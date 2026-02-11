-- ═══════════════════════════════════════════
-- Migration 00038: Automatic PostgREST schema cache reload
--
-- Problem: Migrations 00033-00037 added tables and columns after
-- the one-time NOTIFY in 00032, leaving PostgREST's schema cache stale.
-- This caused errors like: "Could not find 'particulier_telephone' column
-- of 'devis' in the schema cache"
--
-- Solution: A PostgreSQL event trigger that fires NOTIFY pgrst, 'reload schema'
-- after any DDL command (CREATE TABLE, ALTER TABLE, DROP TABLE, etc.).
-- This is the recommended pattern for self-hosted PostgREST/Supabase.
-- See: https://postgrest.org/en/stable/references/schema_cache.html
-- ═══════════════════════════════════════════

-- 1. Event trigger function (must return event_trigger, requires plpgsql)
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

-- 2. Trigger on DDL commands (CREATE, ALTER, COMMENT, GRANT, REVOKE, etc.)
DROP EVENT TRIGGER IF EXISTS pgrst_ddl_watch;
CREATE EVENT TRIGGER pgrst_ddl_watch
  ON ddl_command_end
  EXECUTE FUNCTION public.pgrst_ddl_watch();

-- 3. Trigger on DROP operations (additional safety net)
DROP EVENT TRIGGER IF EXISTS pgrst_drop_watch;
CREATE EVENT TRIGGER pgrst_drop_watch
  ON sql_drop
  EXECUTE FUNCTION public.pgrst_ddl_watch();

-- 4. Immediately reload schema to fix current stale cache
NOTIFY pgrst, 'reload schema';
