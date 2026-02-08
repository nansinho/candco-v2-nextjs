-- ═══════════════════════════════════════════
-- C&CO Formation v2 — Setup Storage bucket "images"
-- Nécessaire pour l'upload d'images et de logos
-- ═══════════════════════════════════════════

-- 1. Créer le bucket "images" (public pour lecture)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  true,
  2097152, -- 2 Mo max
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Politique : les utilisateurs authentifiés peuvent uploader
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'images');

-- 3. Politique : tout le monde peut lire (bucket public)
CREATE POLICY "Public read access for images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'images');

-- 4. Politique : les utilisateurs authentifiés peuvent mettre à jour
CREATE POLICY "Authenticated users can update images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'images');

-- 5. Politique : les utilisateurs authentifiés peuvent supprimer
CREATE POLICY "Authenticated users can delete images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'images');
