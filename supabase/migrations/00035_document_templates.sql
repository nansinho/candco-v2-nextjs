-- ═══════════════════════════════════════════
-- C&CO Formation v2 — Document Templates
-- Templates for auto-generating documents (convention, attestation, etc.)
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  nom text NOT NULL,
  categorie text NOT NULL CHECK (categorie IN (
    'convention', 'contrat_sous_traitance', 'attestation', 'certificat',
    'programme', 'convocation', 'emargement', 'facture', 'devis', 'autre'
  )),
  contenu_html text,           -- Template HTML with {{variables}}
  variables jsonb DEFAULT '[]', -- List of available variables for this template
  actif boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_document_templates_org ON document_templates(organisation_id);
CREATE INDEX idx_document_templates_cat ON document_templates(organisation_id, categorie);

-- RLS
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_templates_select" ON document_templates FOR SELECT
  USING (organisation_id IN (
    SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
  ));

CREATE POLICY "document_templates_insert" ON document_templates FOR INSERT
  WITH CHECK (organisation_id IN (
    SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
  ));

CREATE POLICY "document_templates_update" ON document_templates FOR UPDATE
  USING (organisation_id IN (
    SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
  ));

CREATE POLICY "document_templates_delete" ON document_templates FOR DELETE
  USING (organisation_id IN (
    SELECT organisation_id FROM utilisateurs WHERE id = auth.uid()
  ));
