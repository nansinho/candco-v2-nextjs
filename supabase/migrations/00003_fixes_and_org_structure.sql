-- ═══════════════════════════════════════════
-- Migration 00003: FK Fixes + Enterprise Org Structure
-- ═══════════════════════════════════════════

-- ─── FK CONSTRAINT FIXES ─────────────────────────────────

-- Add missing indexes on junction tables for performance
CREATE INDEX IF NOT EXISTS idx_contact_entreprises_contact ON contact_entreprises(contact_client_id);
CREATE INDEX IF NOT EXISTS idx_contact_entreprises_entreprise ON contact_entreprises(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_apprenant_entreprises_apprenant ON apprenant_entreprises(apprenant_id);
CREATE INDEX IF NOT EXISTS idx_apprenant_entreprises_entreprise ON apprenant_entreprises(entreprise_id);

-- Add indexes on common query columns
CREATE INDEX IF NOT EXISTS idx_entreprises_organisation ON entreprises(organisation_id);
CREATE INDEX IF NOT EXISTS idx_apprenants_organisation ON apprenants(organisation_id);
CREATE INDEX IF NOT EXISTS idx_formateurs_organisation ON formateurs(organisation_id);
CREATE INDEX IF NOT EXISTS idx_contacts_clients_organisation ON contacts_clients(organisation_id);
CREATE INDEX IF NOT EXISTS idx_financeurs_organisation ON financeurs(organisation_id);
CREATE INDEX IF NOT EXISTS idx_taches_organisation ON taches(organisation_id);
CREATE INDEX IF NOT EXISTS idx_activites_organisation ON activites(organisation_id);

-- Add indexes on polymorphic columns
CREATE INDEX IF NOT EXISTS idx_taches_entite ON taches(entite_type, entite_id);
CREATE INDEX IF NOT EXISTS idx_activites_entite ON activites(entite_type, entite_id);

-- ═══════════════════════════════════════════
-- ENTERPRISE ORG STRUCTURE
-- Agences, Pôles, Rôles dans l'entreprise
-- ═══════════════════════════════════════════

-- Agences (sites/établissements d'une entreprise)
CREATE TABLE entreprise_agences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  nom text NOT NULL,
  siret text,                          -- SIRET de l'établissement
  adresse_rue text,
  adresse_complement text,
  adresse_cp text,
  adresse_ville text,
  telephone text,
  email text,
  est_siege boolean DEFAULT false,     -- Est-ce le siège social ?
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Pôles / Départements (au sein d'une entreprise ou agence)
CREATE TABLE entreprise_poles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  agence_id uuid REFERENCES entreprise_agences(id) ON DELETE SET NULL,
  nom text NOT NULL,                   -- Ex: "Pôle Développement", "Service RH"
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Membres (personnes rattachées à une entreprise avec un rôle)
-- Relie les apprenants/contacts à une position dans l'organigramme
CREATE TABLE entreprise_membres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  agence_id uuid REFERENCES entreprise_agences(id) ON DELETE SET NULL,
  pole_id uuid REFERENCES entreprise_poles(id) ON DELETE SET NULL,
  -- Lien vers la personne (soit apprenant, soit contact client)
  apprenant_id uuid REFERENCES apprenants(id) ON DELETE CASCADE,
  contact_client_id uuid REFERENCES contacts_clients(id) ON DELETE CASCADE,
  -- Rôle dans l'entreprise
  role text NOT NULL DEFAULT 'employe', -- directeur, responsable_formation, manager, employe
  fonction text,                        -- Intitulé de poste libre
  -- Contrainte : au moins un lien doit être défini
  CONSTRAINT check_membre_link CHECK (apprenant_id IS NOT NULL OR contact_client_id IS NOT NULL),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for org structure
CREATE INDEX idx_agences_entreprise ON entreprise_agences(entreprise_id);
CREATE INDEX idx_poles_entreprise ON entreprise_poles(entreprise_id);
CREATE INDEX idx_poles_agence ON entreprise_poles(agence_id);
CREATE INDEX idx_membres_entreprise ON entreprise_membres(entreprise_id);
CREATE INDEX idx_membres_agence ON entreprise_membres(agence_id);
CREATE INDEX idx_membres_pole ON entreprise_membres(pole_id);
CREATE INDEX idx_membres_apprenant ON entreprise_membres(apprenant_id);
CREATE INDEX idx_membres_contact ON entreprise_membres(contact_client_id);

-- Updated_at triggers
CREATE TRIGGER update_entreprise_agences_updated_at
  BEFORE UPDATE ON entreprise_agences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_entreprise_poles_updated_at
  BEFORE UPDATE ON entreprise_poles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_entreprise_membres_updated_at
  BEFORE UPDATE ON entreprise_membres
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS Policies ────────────────────────────────────────

ALTER TABLE entreprise_agences ENABLE ROW LEVEL SECURITY;
ALTER TABLE entreprise_poles ENABLE ROW LEVEL SECURITY;
ALTER TABLE entreprise_membres ENABLE ROW LEVEL SECURITY;

-- Agences: access through parent entreprise
CREATE POLICY "Access through entreprise" ON entreprise_agences
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = entreprise_id
      AND organisation_id = (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

-- Poles: access through parent entreprise
CREATE POLICY "Access through entreprise" ON entreprise_poles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = entreprise_id
      AND organisation_id = (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

-- Membres: access through parent entreprise
CREATE POLICY "Access through entreprise" ON entreprise_membres
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = entreprise_id
      AND organisation_id = (
        SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );
