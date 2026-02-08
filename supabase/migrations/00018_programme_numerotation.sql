-- ═══════════════════════════════════════════
-- C&CO Formation v2 — Programme: style de numérotation
-- Permet aux OF de personnaliser l'affichage des modules
-- ═══════════════════════════════════════════

ALTER TABLE produits_formation ADD COLUMN IF NOT EXISTS programme_numerotation text DEFAULT 'arabic';
-- Valeurs possibles : 'arabic' (1,2,3), 'roman' (I,II,III), 'letters' (A,B,C), 'none'
