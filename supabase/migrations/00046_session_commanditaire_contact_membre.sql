-- Migration: Add contact_membre_id to session_commanditaires
-- Purpose: Allow session commanditaires to reference entreprise_membres records
-- (Direction / Responsable de formation) — same pattern as devis.contact_membre_id.

ALTER TABLE session_commanditaires
  ADD COLUMN IF NOT EXISTS contact_membre_id uuid
    REFERENCES entreprise_membres(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_session_commanditaires_contact_membre
  ON session_commanditaires(contact_membre_id);

COMMENT ON COLUMN session_commanditaires.contact_membre_id IS 'Reference to the entreprise_membres record selected as contact. Used when the member is an apprenant (no contact_client_id). When contact_client_id is set, it takes priority.';

NOTIFY pgrst, 'reload schema';
