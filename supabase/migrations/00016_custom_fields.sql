-- ═══════════════════════════════════════════
-- C&CO Formation v2 — Champs personnalisés
-- Permet à chaque OF d'avoir des champs custom
-- sur les produits de formation
-- ═══════════════════════════════════════════

-- Champs personnalisés stockés en JSON sur chaque produit
ALTER TABLE produits_formation ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}';

-- Configuration des champs custom par organisation
-- Stocke la définition des champs (label, type, required, options)
-- dans les settings de l'organisation
-- Exemple: { "custom_field_definitions": [
--   { "key": "ref_qualiopi", "label": "Référence Qualiopi", "type": "text" },
--   { "key": "niveau_difficulte", "label": "Niveau de difficulté", "type": "select", "options": ["Débutant", "Intermédiaire", "Avancé"] }
-- ]}
-- → Pas de nouvelle table nécessaire, on utilise organisations.settings
