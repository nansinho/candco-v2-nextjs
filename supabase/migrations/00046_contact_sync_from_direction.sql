-- Migration: Synchronisation automatique contacts clients ↔ apprenants Direction
-- Ajoute le suivi de la source de synchronisation sur contacts_clients

-- Colonne de traçabilité : quel apprenant est la source de ce contact synchronisé
ALTER TABLE contacts_clients
  ADD COLUMN IF NOT EXISTS sync_source_apprenant_id uuid REFERENCES apprenants(id) ON DELETE SET NULL;

-- Index pour recherche rapide lors des mises à jour d'apprenants
CREATE INDEX IF NOT EXISTS idx_contacts_clients_sync_source
  ON contacts_clients(sync_source_apprenant_id)
  WHERE sync_source_apprenant_id IS NOT NULL;

COMMENT ON COLUMN contacts_clients.sync_source_apprenant_id IS
  'Si défini, ce contact a été créé automatiquement depuis un apprenant ayant le rôle "Direction". Les champs sont synchronisés.';

-- Force le rechargement du cache PostgREST
NOTIFY pgrst, 'reload schema';
