-- Field evidence stays private. The application signs short-lived downloads
-- after checking the active caller and assignment. Uploads use a server-issued
-- signed token or a scoped server action. Public gallery media remains separate.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'service-evidence' AND public = false) THEN
    RAISE EXCEPTION 'Expected private service-evidence bucket before migration 042';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'job-photos') THEN
    RAISE EXCEPTION 'Expected job-photos bucket before migration 042';
  END IF;
END $$;

-- Existing links remain in historical metadata, but will no longer grant
-- access. The compatible application reads storage_path and signs each view.
UPDATE storage.buckets SET public = false WHERE id = 'job-photos';

DROP POLICY IF EXISTS "Authenticated users can read service evidence" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload service evidence" ON storage.objects;
DROP POLICY IF EXISTS "Public can view job photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view job photos storage" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload job photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete job photos" ON storage.objects;

-- Gallery writes go through the owner-authorized server action; public reads
-- of deliberately published gallery objects are preserved.
DROP POLICY IF EXISTS "Staff can upload gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete gallery images" ON storage.objects;

-- Reports are also delivered through scoped short-lived signed URLs.
DROP POLICY IF EXISTS "Staff can read service reports" ON storage.objects;

-- The legacy field path still serves some jobs. Use the same current-account,
-- direct-assignment and active-crew rule for its rows and signed photo links.
CREATE OR REPLACE FUNCTION public.can_access_legacy_job(p_job_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.jobs j ON j.id = p_job_id
    WHERE p.id = auth.uid() AND p.status = 'active'
      AND (
        p.role = 'owner'
        OR (p.role IN ('mowing_crew_lead', 'mowing_crew_laborer',
                       'snow_plow_operator', 'subcontractor')
          AND (
            EXISTS (SELECT 1 FROM public.job_assignments ja
              WHERE ja.job_id = j.id AND ja.employee_id = p.id)
            OR EXISTS (SELECT 1 FROM public.crews c
              JOIN public.crew_members cm ON cm.crew_id = c.id
              WHERE c.id = j.crew_id AND c.active = true AND cm.employee_id = p.id)
          ))
      )
  )
$$;
REVOKE ALL ON FUNCTION public.can_access_legacy_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_legacy_job(uuid) TO authenticated;

DROP POLICY IF EXISTS "Staff can view job photos" ON public.job_photos;
CREATE POLICY "Active assigned workers can view job photos" ON public.job_photos
  FOR SELECT TO authenticated USING (public.can_access_legacy_job(job_id));
DROP POLICY IF EXISTS "Assigned employees can insert job photos" ON public.job_photos;
CREATE POLICY "Active assigned workers can insert job photos" ON public.job_photos
  FOR INSERT TO authenticated WITH CHECK (
    employee_id = auth.uid() AND public.can_access_legacy_job(job_id));

DROP POLICY IF EXISTS "Staff can view job location tags" ON public.job_location_tags;
CREATE POLICY "Active assigned workers can view job location tags" ON public.job_location_tags
  FOR SELECT TO authenticated USING (public.can_access_legacy_job(job_id));
DROP POLICY IF EXISTS "Assigned employees can insert job location tags" ON public.job_location_tags;
CREATE POLICY "Active assigned workers can insert job location tags" ON public.job_location_tags
  FOR INSERT TO authenticated WITH CHECK (
    employee_id = auth.uid() AND public.can_access_legacy_job(job_id));

CREATE POLICY "Active assigned workers can view legacy jobs" ON public.jobs
  FOR SELECT TO authenticated USING (public.can_access_legacy_job(id));
