-- Migration: Ajout de l'option exonération TVA sur les devis et factures
-- Article 261-4-4a du CGI — exonération de TVA pour les organismes de formation

ALTER TABLE devis ADD COLUMN IF NOT EXISTS exoneration_tva boolean NOT NULL DEFAULT false;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS exoneration_tva boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN devis.exoneration_tva IS 'Exonération TVA art. 261-4-4a du CGI. Quand true, toutes les lignes ont TVA=0%.';
COMMENT ON COLUMN factures.exoneration_tva IS 'Exonération TVA art. 261-4-4a du CGI. Propagé depuis le devis lors de la conversion.';
