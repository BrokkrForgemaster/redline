-- Lightweight job photo table for field crew use
CREATE TABLE IF NOT EXISTS job_photos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  employee_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  storage_path TEXT NOT NULL,
  url          TEXT NOT NULL,
  photo_type   TEXT NOT NULL CHECK (photo_type IN ('before', 'after', 'during')),
  taken_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_photos_job  ON job_photos(job_id);
CREATE INDEX idx_job_photos_type ON job_photos(job_id, photo_type);

-- Storage bucket for field photos (public read, authenticated write)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-photos',
  'job-photos',
  true,
  15728640, -- 15 MB per photo
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 15728640,
      allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'];

DROP POLICY IF EXISTS "Public can view job photos"    ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload job photos"   ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete job photos"   ON storage.objects;

CREATE POLICY "Public can view job photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'job-photos');

CREATE POLICY "Staff can upload job photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'job-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Staff can delete job photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'job-photos' AND auth.role() = 'authenticated');
