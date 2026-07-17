-- Create the gallery storage bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gallery',
  'gallery',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 10485760,
      allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'];

-- Drop existing policies first to allow re-running
DROP POLICY IF EXISTS "Public can view gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete gallery images" ON storage.objects;

-- Public read access for gallery images
CREATE POLICY "Public can view gallery images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gallery');

-- Authenticated users can upload
CREATE POLICY "Staff can upload gallery images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'gallery' AND auth.role() = 'authenticated');

-- Authenticated users can update (replace)
CREATE POLICY "Staff can update gallery images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'gallery' AND auth.role() = 'authenticated');

-- Authenticated users can delete
CREATE POLICY "Staff can delete gallery images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'gallery' AND auth.role() = 'authenticated');
