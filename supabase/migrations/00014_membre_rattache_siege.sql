-- Migration 00014: Add rattache_siege to entreprise_membres
--
-- Allows marking a member as attached to the company's head office (siège social).

ALTER TABLE entreprise_membres
  ADD COLUMN IF NOT EXISTS rattache_siege boolean NOT NULL DEFAULT false;
