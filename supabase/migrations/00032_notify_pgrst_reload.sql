-- ═══════════════════════════════════════════
-- Migration 00032: Notify PostgREST to reload schema cache
--
-- Fixes: "Could not find the 'tarif_id' column of 'besoins_formation' in the schema cache"
-- Root cause: migration 00029 added tarif_id but PostgREST cache was never refreshed.
--
-- Also creates a reusable function for future migrations.
-- ═══════════════════════════════════════════

-- 1. Create reusable function for future DDL migrations
CREATE OR REPLACE FUNCTION public.notify_pgrst_reload()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  NOTIFY pgrst, 'reload schema';
$$;

-- 2. Grant execute to migration runner and service_role
GRANT EXECUTE ON FUNCTION public.notify_pgrst_reload() TO postgres;
GRANT EXECUTE ON FUNCTION public.notify_pgrst_reload() TO service_role;

-- 3. Immediately trigger the reload
NOTIFY pgrst, 'reload schema';
