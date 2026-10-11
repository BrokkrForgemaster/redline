-- ============================================================
-- Job Photos
-- Migration: 006_job_photos.sql
-- Adds legacy field-job photo evidence storage used by
-- app/(app)/my-jobs/[jobId] before the service-run media flow.
-- ============================================================

CREATE TABLE IF NOT EXISTS job_photos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  employee_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  url          TEXT NOT NULL,
  photo_type   TEXT NOT NULL CHECK (photo_type IN ('before', 'after')),
  caption      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(storage_path)
);

CREATE INDEX IF NOT EXISTS idx_job_photos_job ON job_photos(job_id);
CREATE INDEX IF NOT EXISTS idx_job_photos_employee ON job_photos(employee_id);
CREATE INDEX IF NOT EXISTS idx_job_photos_type ON job_photos(photo_type);

ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view job photos" ON job_photos;
DROP POLICY IF EXISTS "Assigned employees can insert job photos" ON job_photos;
DROP POLICY IF EXISTS "Owners and admins can delete job photos" ON job_photos;

CREATE POLICY "Staff can view job photos"
  ON job_photos FOR SELECT
  USING (
    is_staff()
    OR employee_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM job_assignments ja
      WHERE ja.job_id = job_photos.job_id
        AND ja.employee_id = auth.uid()
    )
  );

CREATE POLICY "Assigned employees can insert job photos"
  ON job_photos FOR INSERT
  WITH CHECK (
    employee_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM job_assignments ja
      WHERE ja.job_id = job_photos.job_id
        AND ja.employee_id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can delete job photos"
  ON job_photos FOR DELETE
  USING (is_owner_or_admin());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-photos',
  'job-photos',
  true,
  15728640,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 15728640,
      allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'];

DROP POLICY IF EXISTS "Public can view job photos storage" ON storage.objects;

CREATE POLICY "Public can view job photos storage"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'job-photos');
