-- ============================================================
-- Job Location Tags
-- Migration: 012_job_location_tags.sql
-- Adds phone GPS tags to legacy jobs and optional GPS metadata
-- to before/after job photos.
-- ============================================================

ALTER TABLE job_photos
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS accuracy_meters NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS captured_at_device TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS job_location_tags (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id             UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  employee_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_photo_id       UUID REFERENCES job_photos(id) ON DELETE SET NULL,
  tag_type           TEXT NOT NULL CHECK (
    tag_type IN ('manual', 'start', 'finish', 'photo_before', 'photo_after')
  ),
  latitude           NUMERIC(10,7) NOT NULL,
  longitude          NUMERIC(10,7) NOT NULL,
  accuracy_meters    NUMERIC(8,2) NOT NULL CHECK (accuracy_meters >= 0),
  captured_at_device TIMESTAMPTZ NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_location_tags_job
  ON job_location_tags(job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_location_tags_employee
  ON job_location_tags(employee_id, created_at DESC);

ALTER TABLE job_location_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view job location tags" ON job_location_tags;
DROP POLICY IF EXISTS "Assigned employees can insert job location tags" ON job_location_tags;

CREATE POLICY "Staff can view job location tags"
  ON job_location_tags FOR SELECT
  USING (
    is_staff()
    OR employee_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM job_assignments ja
      WHERE ja.job_id = job_location_tags.job_id
        AND ja.employee_id = auth.uid()
    )
  );

CREATE POLICY "Assigned employees can insert job location tags"
  ON job_location_tags FOR INSERT
  WITH CHECK (
    employee_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM job_assignments ja
      WHERE ja.job_id = job_location_tags.job_id
        AND ja.employee_id = auth.uid()
    )
  );
