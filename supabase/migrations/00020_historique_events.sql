-- ═══════════════════════════════════════════════════════════
-- HISTORIQUE EVENTS — Audit log automatique
-- Toute action dans le logiciel génère automatiquement une entrée
-- ═══════════════════════════════════════════════════════════

CREATE TABLE historique_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  -- Horodatage
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Qui (utilisateur ou système)
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_nom text,                    -- Cache pour affichage ("Jean Dupont")
  user_role text,                   -- admin, manager, user, formateur, apprenant, contact_client, systeme

  -- Origine
  origine text NOT NULL DEFAULT 'backoffice',  -- backoffice, extranet, systeme

  -- Module source
  module text NOT NULL,             -- entreprise, apprenant, contact_client, formateur, financeur, produit, session, inscription, devis, facture, avoir, tache, activite, salle, email, organisation, questionnaire, opportunite

  -- Action effectuée
  action text NOT NULL,             -- created, updated, archived, unarchived, deleted, status_changed, linked, unlinked, imported, sent, signed, completed, generated

  -- Objet concerné (type + identifiant)
  entite_type text NOT NULL,        -- entreprise, apprenant, session, etc.
  entite_id uuid NOT NULL,
  entite_label text,                -- "ENT-0056 — Formation ABC" pour affichage

  -- Entreprise concernée (pour filtrage historique entreprise)
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE SET NULL,

  -- Description lisible
  description text NOT NULL,

  -- Lien direct vers l'élément source
  objet_href text,                  -- /entreprises/uuid, /sessions/uuid, etc.

  -- Données impactées (résumé des changements)
  metadata jsonb DEFAULT '{}',      -- { changed_fields: [...], old_values: {...}, new_values: {...} }

  -- Agence (si applicable)
  agence_id uuid,
  agence_nom text
);

-- ─── Index pour les requêtes fréquentes ───────────────────

-- Historique d'une entreprise (le cas d'usage principal)
CREATE INDEX idx_historique_events_entreprise
  ON historique_events (entreprise_id, created_at DESC)
  WHERE entreprise_id IS NOT NULL;

-- Historique par organisation (timeline globale)
CREATE INDEX idx_historique_events_org
  ON historique_events (organisation_id, created_at DESC);

-- Historique par entité (vue détail de n'importe quelle entité)
CREATE INDEX idx_historique_events_entite
  ON historique_events (entite_type, entite_id, created_at DESC);

-- Filtrage par module
CREATE INDEX idx_historique_events_module
  ON historique_events (organisation_id, module, created_at DESC);

-- Filtrage par utilisateur
CREATE INDEX idx_historique_events_user
  ON historique_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE historique_events ENABLE ROW LEVEL SECURITY;

-- Lecture : utilisateurs de la même organisation
CREATE POLICY "historique_events_select" ON historique_events
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  );

-- Insertion : utilisateurs authentifiés de la même organisation
CREATE POLICY "historique_events_insert" ON historique_events
  FOR INSERT WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  );

-- Pas de UPDATE ni DELETE — l'historique est immuable
-- (les admins via service_role peuvent quand même intervenir si nécessaire)

-- ─── Commentaires ─────────────────────────────────────────

COMMENT ON TABLE historique_events IS 'Journal automatique de toutes les actions effectuées dans le logiciel. Immuable.';
COMMENT ON COLUMN historique_events.entreprise_id IS 'FK vers l''entreprise concernée pour filtrage dans l''onglet Historique entreprise. NULL si l''action ne concerne pas directement une entreprise.';
COMMENT ON COLUMN historique_events.metadata IS 'Données impactées : champs modifiés, anciennes/nouvelles valeurs, contexte supplémentaire.';
COMMENT ON COLUMN historique_events.origine IS 'Source de l''action : backoffice (admin/manager), extranet (formateur/apprenant/client), systeme (automatisation).';
