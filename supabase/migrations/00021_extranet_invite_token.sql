-- Add custom invite token with 24h expiration to extranet_acces
-- Replaces reliance on Supabase magic link tokens (which expire after 1h)

ALTER TABLE extranet_acces
  ADD COLUMN IF NOT EXISTS invite_token text,
  ADD COLUMN IF NOT EXISTS invite_token_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_extranet_acces_invite_token
  ON extranet_acces(invite_token) WHERE invite_token IS NOT NULL;
