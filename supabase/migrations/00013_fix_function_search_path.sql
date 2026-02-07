-- Migration 00013: Fix function search_path mutable warnings
--
-- PostgreSQL best practice: set search_path on SECURITY DEFINER functions
-- and any function exposed via PostgREST to prevent search_path injection.

-- ═══════════════════════════════════════════
-- 1. auth_organisation_id — already SECURITY DEFINER, add search_path
-- ═══════════════════════════════════════════

CREATE OR REPLACE FUNCTION auth_organisation_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT organisation_id FROM public.utilisateurs WHERE id = (select auth.uid())
$$;

-- ═══════════════════════════════════════════
-- 2. next_numero — add search_path
-- ═══════════════════════════════════════════

CREATE OR REPLACE FUNCTION next_numero(
  p_organisation_id uuid,
  p_entite text,
  p_year int DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_compteur int;
BEGIN
  -- Upsert and increment counter
  INSERT INTO public.sequences (organisation_id, entite, compteur)
  VALUES (p_organisation_id, p_entite, 1)
  ON CONFLICT (organisation_id, entite)
  DO UPDATE SET compteur = public.sequences.compteur + 1
  RETURNING compteur INTO v_compteur;

  -- Format: PREFIX-0001 or PREFIX-YEAR-0001
  IF p_year IS NOT NULL THEN
    RETURN p_entite || '-' || p_year || '-' || lpad(v_compteur::text, 4, '0');
  ELSE
    RETURN p_entite || '-' || lpad(v_compteur::text, 4, '0');
  END IF;
END;
$$;

-- ═══════════════════════════════════════════
-- 3. update_updated_at — add search_path
-- ═══════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
