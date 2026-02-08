-- Migration 00018: Add metadata column to emails_envoyes for targeted email traceability

ALTER TABLE emails_envoyes ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE INDEX IF NOT EXISTS idx_emails_envoyes_entite ON emails_envoyes(entite_type, entite_id);
