-- ═══════════════════════════════════════════
-- C&CO Formation v2 — Setup Storage bucket "documents"
-- Nécessaire pour les PDFs générés (devis, factures, conventions, attestations)
-- ═══════════════════════════════════════════

-- 1. Créer le bucket "documents" (public pour lecture)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  10485760, -- 10 Mo max
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'image/png', 'image/jpeg'],
  file_size_limit = 10485760;

-- 2. Politique : les utilisateurs authentifiés peuvent uploader
CREATE POLICY IF NOT EXISTS "Authenticated users can upload documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents');

-- 3. Politique : tout le monde peut lire (bucket public)
CREATE POLICY IF NOT EXISTS "Public read access for documents"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'documents');

-- 4. Politique : les utilisateurs authentifiés peuvent mettre à jour
CREATE POLICY IF NOT EXISTS "Authenticated users can update documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents');

-- 5. Politique : les utilisateurs authentifiés peuvent supprimer
CREATE POLICY IF NOT EXISTS "Authenticated users can delete documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents');
