-- Migration 00046: Add formation metadata and participants presents columns to factures
-- These columns support creating invoices from session devis with present learner tracking.
-- Formation metadata mirrors the devis fields; participants_presents is a JSONB snapshot.

ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS lieu_formation text,
  ADD COLUMN IF NOT EXISTS dates_formation text,
  ADD COLUMN IF NOT EXISTS dates_formation_jours date[],
  ADD COLUMN IF NOT EXISTS nombre_participants_prevu int,
  ADD COLUMN IF NOT EXISTS modalite_pedagogique text,
  ADD COLUMN IF NOT EXISTS duree_formation text,
  ADD COLUMN IF NOT EXISTS participants_presents jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN factures.lieu_formation IS 'Lieu de la formation (copié depuis le devis)';
COMMENT ON COLUMN factures.dates_formation IS 'Dates de formation (texte libre, copié depuis le devis)';
COMMENT ON COLUMN factures.dates_formation_jours IS 'Jours individuels de formation (date array, copié depuis le devis)';
COMMENT ON COLUMN factures.nombre_participants_prevu IS 'Nombre de participants prévus (copié depuis le devis)';
COMMENT ON COLUMN factures.modalite_pedagogique IS 'Modalité pédagogique: présentiel, distanciel, mixte (copié depuis le devis)';
COMMENT ON COLUMN factures.duree_formation IS 'Durée de la formation (copié depuis le devis)';
COMMENT ON COLUMN factures.participants_presents IS 'Snapshot JSONB des apprenants présents. Chaque entrée: {apprenant_id, prenom, nom, dates_presence[], agence?}';

NOTIFY pgrst, 'reload schema';
