-- ═══════════════════════════════════════════
-- C&CO Formation v2 — Messagerie temps réel
-- Phase 12 : Conversations + Messages via Supabase Realtime
-- ═══════════════════════════════════════════

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('direct', 'session_group', 'support')),
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  titre text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_conversations_org ON conversations(organisation_id);
CREATE INDEX idx_conversations_session ON conversations(session_id);

-- Participants
CREATE TABLE IF NOT EXISTS conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text CHECK (role IN ('admin', 'formateur', 'apprenant', 'contact_client')),
  dernier_lu_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX idx_conv_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_conv_participants_conv ON conversation_participants(conversation_id);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  contenu text NOT NULL,
  fichier_url text,
  fichier_nom text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_messages_conv ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(conversation_id, created_at DESC);

-- ─── RLS ────────────────────────────────────────────────

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Conversations: visible if you're a participant OR an admin of the org
CREATE POLICY "conversations_select" ON conversations FOR SELECT
  USING (
    id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid())
    OR organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid())
  );

CREATE POLICY "conversations_insert" ON conversations FOR INSERT
  WITH CHECK (
    organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid())
    OR organisation_id IN (
      SELECT ea.organisation_id FROM extranet_acces ea WHERE ea.user_id = auth.uid() AND ea.statut = 'actif'
    )
  );

-- Participants: visible if you're in the conversation
CREATE POLICY "conv_participants_select" ON conversation_participants FOR SELECT
  USING (
    conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid())
    OR conversation_id IN (
      SELECT c.id FROM conversations c
      JOIN utilisateurs u ON u.organisation_id = c.organisation_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "conv_participants_insert" ON conversation_participants FOR INSERT
  WITH CHECK (true); -- Server-side via admin client

CREATE POLICY "conv_participants_update" ON conversation_participants FOR UPDATE
  USING (user_id = auth.uid());

-- Messages: visible if you're a participant
CREATE POLICY "messages_select" ON messages FOR SELECT
  USING (
    conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid())
    OR organisation_id IN (SELECT organisation_id FROM utilisateurs WHERE id = auth.uid())
  );

CREATE POLICY "messages_insert" ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid())
  );

-- ─── Enable Realtime ────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
