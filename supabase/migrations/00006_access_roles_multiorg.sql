-- ═══════════════════════════════════════════
-- C&CO Formation v2 — Phase 8
-- Accès, Rôles & Multi-organisation
-- Tables: user_organisations, extranet_acces
-- Colonnes: utilisateurs.is_super_admin, apprenants.extranet_*, organisations.vitrine_*
-- ═══════════════════════════════════════════

-- ═══════════════════════════════════════════
-- ALTER TABLES — Nouvelles colonnes
-- ═══════════════════════════════════════════

-- Super-admin sur utilisateurs
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS is_super_admin boolean DEFAULT false NOT NULL;

-- Extranet sur apprenants (manquant jusqu'ici)
ALTER TABLE apprenants ADD COLUMN IF NOT EXISTS extranet_actif boolean DEFAULT false NOT NULL;
ALTER TABLE apprenants ADD COLUMN IF NOT EXISTS extranet_user_id uuid;

-- Vitrine sur organisations
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS vitrine_active boolean DEFAULT false NOT NULL;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS sous_domaine text UNIQUE;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS domaine_custom text UNIQUE;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS vitrine_config jsonb DEFAULT '{}';

-- ═══════════════════════════════════════════
-- USER_ORGANISATIONS — Multi-org (admin peut gérer plusieurs OF)
-- ═══════════════════════════════════════════

CREATE TABLE user_organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role text DEFAULT 'admin' NOT NULL CHECK (role IN ('admin', 'manager', 'user')),
  is_default boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, organisation_id)
);

CREATE INDEX idx_user_organisations_user ON user_organisations(user_id);
CREATE INDEX idx_user_organisations_org ON user_organisations(organisation_id);

-- RLS
ALTER TABLE user_organisations ENABLE ROW LEVEL SECURITY;

-- Un utilisateur peut voir ses propres rattachements
CREATE POLICY "user_organisations_select_own" ON user_organisations FOR SELECT
  USING (user_id = auth.uid());

-- Un super-admin peut tout voir
CREATE POLICY "user_organisations_select_superadmin" ON user_organisations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Un admin de l'org peut gérer les rattachements de son org
CREATE POLICY "user_organisations_insert" ON user_organisations FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid() AND role = 'admin'
    )
    OR EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "user_organisations_update" ON user_organisations FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid() AND role = 'admin'
    )
    OR EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "user_organisations_delete" ON user_organisations FOR DELETE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid() AND role = 'admin'
    )
    OR EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND is_super_admin = true)
  );

-- ═══════════════════════════════════════════
-- EXTRANET_ACCES — Accès externes (formateur, apprenant, contact client)
-- ═══════════════════════════════════════════

CREATE TABLE extranet_acces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('formateur', 'apprenant', 'contact_client')),
  entite_type text NOT NULL CHECK (entite_type IN ('formateur', 'apprenant', 'contact_client')),
  entite_id uuid NOT NULL,
  statut text DEFAULT 'invite' NOT NULL CHECK (statut IN ('invite', 'en_attente', 'actif', 'desactive')),
  invite_le timestamptz,
  active_le timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (organisation_id, user_id, entite_type, entite_id)
);

CREATE INDEX idx_extranet_acces_org ON extranet_acces(organisation_id);
CREATE INDEX idx_extranet_acces_user ON extranet_acces(user_id);
CREATE INDEX idx_extranet_acces_entite ON extranet_acces(entite_type, entite_id);

-- Trigger updated_at
CREATE TRIGGER set_extranet_acces_updated_at
  BEFORE UPDATE ON extranet_acces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE extranet_acces ENABLE ROW LEVEL SECURITY;

-- Un utilisateur extranet peut voir ses propres accès
CREATE POLICY "extranet_acces_select_own" ON extranet_acces FOR SELECT
  USING (user_id = auth.uid());

-- Les admins de l'org peuvent voir/gérer les accès extranet de leur org
CREATE POLICY "extranet_acces_select_org" ON extranet_acces FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  );

CREATE POLICY "extranet_acces_insert" ON extranet_acces FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "extranet_acces_update" ON extranet_acces FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "extranet_acces_delete" ON extranet_acces FOR DELETE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ═══════════════════════════════════════════
-- Seed : Créer les entrées user_organisations pour les utilisateurs existants
-- (chaque utilisateur existant est rattaché à son org actuelle)
-- ═══════════════════════════════════════════

INSERT INTO user_organisations (user_id, organisation_id, role, is_default)
SELECT id, organisation_id, role, true
FROM utilisateurs
ON CONFLICT DO NOTHING;
