-- Counts use the full owner-scoped dataset. A legacy job mapped to a work order
-- contributes only through the canonical work order, regardless of its old state.
CREATE OR REPLACE FUNCTION public.owner_dashboard_counts()
RETURNS TABLE(active_jobs bigint, open_work_orders bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'owner' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Owner access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    (
      SELECT count(*) FROM public.work_orders wo
      WHERE wo.status::text IN ('in_progress', 'paused')
    ) + (
      SELECT count(*) FROM public.jobs j
      WHERE j.status::text IN ('en_route', 'arrived', 'in_progress', 'paused')
        AND NOT EXISTS (
          SELECT 1 FROM public.work_orders wo WHERE wo.legacy_job_id = j.id
        )
    ),
    (
      SELECT count(*) FROM public.work_orders wo
      WHERE wo.status::text IN
        ('scheduled', 'assigned', 'ready', 'in_progress', 'paused', 'submitted', 'needs_review')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.owner_dashboard_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_dashboard_counts() FROM anon;
GRANT EXECUTE ON FUNCTION public.owner_dashboard_counts() TO authenticated;
