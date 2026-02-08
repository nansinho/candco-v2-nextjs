-- Migration 00017 — Champ "Organisé par" sur les produits de formation
-- Permet d'associer un organisme organisateur (nom + logo) à chaque formation

ALTER TABLE produits_formation
  ADD COLUMN IF NOT EXISTS organise_par_nom text,
  ADD COLUMN IF NOT EXISTS organise_par_logo_url text,
  ADD COLUMN IF NOT EXISTS organise_par_actif boolean DEFAULT false;
