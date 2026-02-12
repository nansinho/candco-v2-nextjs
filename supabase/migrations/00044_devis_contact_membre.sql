-- Migration: Add contact_membre_id to devis
-- Purpose: Allow devis to reference siege members who are apprenants (not contacts_clients).
-- When a siege member is selected as the contact for a devis, this column stores the
-- entreprise_membres record id, enabling lookup of contact info from either contacts_clients
-- or apprenants depending on the member type.

ALTER TABLE devis
  ADD COLUMN IF NOT EXISTS contact_membre_id uuid REFERENCES entreprise_membres(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_devis_contact_membre ON devis(contact_membre_id);

COMMENT ON COLUMN devis.contact_membre_id IS 'Reference to the entreprise_membres record selected as contact. Used when the siege member is an apprenant (no contact_client_id). When contact_client_id is set, it takes priority.';

NOTIFY pgrst, 'reload schema';
