-- ═══════════════════════════════════════════
-- C&CO Formation v2 — Système de Tickets
-- Support back-office + extranets
-- ═══════════════════════════════════════════

-- 1. Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  numero_affichage text,
  titre text NOT NULL,
  description text,
  statut text NOT NULL DEFAULT 'ouvert' CHECK (statut IN (
    'ouvert', 'en_cours', 'en_attente', 'resolu', 'ferme'
  )),
  priorite text NOT NULL DEFAULT 'normale' CHECK (priorite IN (
    'basse', 'normale', 'haute', 'urgente'
  )),
  categorie text CHECK (categorie IN (
    'bug', 'demande', 'question', 'amelioration', 'autre'
  )),
  -- Classement par client
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE SET NULL,
  -- Auteur (back-office OU extranet)
  auteur_user_id uuid,
  auteur_type text NOT NULL CHECK (auteur_type IN (
    'admin', 'manager', 'user', 'formateur', 'apprenant', 'contact_client'
  )),
  auteur_nom text,
  auteur_email text,
  -- Assignation
  assignee_id uuid REFERENCES utilisateurs(id) ON DELETE SET NULL,
  -- Dates
  resolved_at timestamptz,
  closed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_org ON tickets(organisation_id);
CREATE INDEX idx_tickets_statut ON tickets(organisation_id, statut);
CREATE INDEX idx_tickets_entreprise ON tickets(entreprise_id);
CREATE INDEX idx_tickets_auteur ON tickets(auteur_user_id);
CREATE INDEX idx_tickets_assignee ON tickets(assignee_id);
CREATE INDEX idx_tickets_created ON tickets(organisation_id, created_at DESC);

-- 2. Messages dans un ticket (conversation)
CREATE TABLE IF NOT EXISTS ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  auteur_user_id uuid,
  auteur_type text NOT NULL CHECK (auteur_type IN (
    'admin', 'manager', 'user', 'formateur', 'apprenant', 'contact_client', 'systeme'
  )),
  auteur_nom text,
  contenu text NOT NULL,
  is_internal boolean DEFAULT false,
  fichiers jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_messages_ticket ON ticket_messages(ticket_id);
CREATE INDEX idx_ticket_messages_created ON ticket_messages(ticket_id, created_at ASC);

-- 3. Mentions @ dans les messages
CREATE TABLE IF NOT EXISTS ticket_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES ticket_messages(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL,
  mentioned_name text,
  notified boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_mentions_user ON ticket_mentions(mentioned_user_id);
CREATE INDEX idx_ticket_mentions_ticket ON ticket_mentions(ticket_id);

-- 4. Historique des changements sur un ticket
CREATE TABLE IF NOT EXISTS ticket_historique (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  auteur_user_id uuid,
  auteur_nom text,
  action text NOT NULL CHECK (action IN (
    'created', 'status_changed', 'priority_changed', 'assigned', 'unassigned',
    'category_changed', 'entreprise_changed', 'replied', 'closed', 'reopened'
  )),
  ancien_valeur text,
  nouveau_valeur text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_historique_ticket ON ticket_historique(ticket_id);
CREATE INDEX idx_ticket_historique_created ON ticket_historique(ticket_id, created_at ASC);

-- ═══════════════════════════════════════════
-- Séquence pour numéro d'affichage TIC-xxxx
-- ═══════════════════════════════════════════

INSERT INTO sequences (id, organisation_id, entite, compteur)
SELECT gen_random_uuid(), id, 'TIC', 0 FROM organisations
WHERE NOT EXISTS (
  SELECT 1 FROM sequences WHERE sequences.organisation_id = organisations.id AND entite = 'TIC'
);

-- ═══════════════════════════════════════════
-- RLS policies
-- ═══════════════════════════════════════════

-- tickets
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_select" ON tickets FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
    OR auteur_user_id = auth.uid()
  );

CREATE POLICY "tickets_insert" ON tickets FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
    OR auteur_user_id = auth.uid()
  );

CREATE POLICY "tickets_update" ON tickets FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
    OR auteur_user_id = auth.uid()
  );

CREATE POLICY "tickets_delete" ON tickets FOR DELETE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
    )
  );

-- ticket_messages
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tm_select" ON ticket_messages FOR SELECT
  USING (ticket_id IN (
    SELECT id FROM tickets WHERE
      organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid())
      OR auteur_user_id = auth.uid()
  ));

CREATE POLICY "tm_insert" ON ticket_messages FOR INSERT
  WITH CHECK (ticket_id IN (
    SELECT id FROM tickets WHERE
      organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid())
      OR auteur_user_id = auth.uid()
  ));

CREATE POLICY "tm_delete" ON ticket_messages FOR DELETE
  USING (ticket_id IN (
    SELECT id FROM tickets WHERE
      organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid())
  ));

-- ticket_mentions
ALTER TABLE ticket_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tmen_select" ON ticket_mentions FOR SELECT
  USING (ticket_id IN (
    SELECT id FROM tickets WHERE
      organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid())
      OR auteur_user_id = auth.uid()
  ));

CREATE POLICY "tmen_insert" ON ticket_mentions FOR INSERT
  WITH CHECK (ticket_id IN (
    SELECT id FROM tickets WHERE
      organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid())
      OR auteur_user_id = auth.uid()
  ));

-- ticket_historique
ALTER TABLE ticket_historique ENABLE ROW LEVEL SECURITY;

CREATE POLICY "th_select" ON ticket_historique FOR SELECT
  USING (ticket_id IN (
    SELECT id FROM tickets WHERE
      organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid())
      OR auteur_user_id = auth.uid()
  ));

CREATE POLICY "th_insert" ON ticket_historique FOR INSERT
  WITH CHECK (ticket_id IN (
    SELECT id FROM tickets WHERE
      organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid())
      OR auteur_user_id = auth.uid()
  ));

-- ═══════════════════════════════════════════
-- Enable Realtime
-- ═══════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_messages;

-- ═══════════════════════════════════════════
-- Storage bucket for ticket attachments
-- ═══════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('tickets', 'tickets', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to tickets bucket
CREATE POLICY "tickets_storage_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'tickets' AND auth.role() = 'authenticated');

CREATE POLICY "tickets_storage_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'tickets' AND auth.role() = 'authenticated');

CREATE POLICY "tickets_storage_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'tickets' AND auth.role() = 'authenticated');
