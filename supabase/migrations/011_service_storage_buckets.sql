-- ============================================================
-- Service Storage Buckets
-- Migration: 011_service_storage_buckets.sql
-- Creates private buckets used by service-run evidence uploads and
-- generated PDF reports.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-evidence',
  'service-evidence',
  false,
  20971520,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 20971520,
      allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-reports',
  'service-reports',
  false,
  20971520,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 20971520,
      allowed_mime_types = ARRAY['application/pdf'];

DROP POLICY IF EXISTS "Authenticated users can upload service evidence" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read service evidence" ON storage.objects;
DROP POLICY IF EXISTS "Staff can read service reports" ON storage.objects;

CREATE POLICY "Authenticated users can upload service evidence"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'service-evidence'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can read service evidence"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'service-evidence'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Staff can read service reports"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'service-reports'
    AND public.is_staff()
  );
