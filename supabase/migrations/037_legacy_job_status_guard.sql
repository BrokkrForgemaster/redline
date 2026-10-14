-- Legacy scheduling changes remain available to the owner while field
-- start/finish belongs to the canonical service visit workflow.
DROP POLICY IF EXISTS "Crew leaders can update their jobs" ON public.jobs;

CREATE OR REPLACE FUNCTION public.change_legacy_job_status(
  p_job_id uuid, p_status public.job_status
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  previous_status public.job_status;
  permitted boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'owner' AND status = 'active'
  ) OR COALESCE(auth.jwt()->>'aal', '') <> 'aal2' THEN
    RAISE EXCEPTION 'Active owner MFA required' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO previous_status FROM public.jobs
  WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job unavailable' USING ERRCODE = 'P0002';
  END IF;
  IF previous_status = p_status THEN
    RETURN;
  END IF;

  permitted := CASE previous_status
    WHEN 'pending_approval' THEN p_status IN ('approved', 'cancelled')
    WHEN 'approved' THEN p_status IN ('ready_to_schedule', 'cancelled')
    WHEN 'awaiting_deposit' THEN p_status IN ('ready_to_schedule', 'cancelled')
    WHEN 'awaiting_materials' THEN p_status IN ('ready_to_schedule', 'cancelled')
    WHEN 'ready_to_schedule' THEN p_status IN ('scheduled', 'cancelled')
    WHEN 'scheduled' THEN p_status IN ('weather_delayed', 'cancelled')
    WHEN 'weather_delayed' THEN p_status IN ('scheduled', 'cancelled')
    WHEN 'completed' THEN p_status = 'archived'
    ELSE false
  END;
  IF NOT permitted THEN
    RAISE EXCEPTION 'Use the visit workflow or reconcile the current status'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.jobs SET status = p_status, updated_by = auth.uid(),
    updated_at = now() WHERE id = p_job_id;
  INSERT INTO public.job_status_history(job_id, from_status, to_status, changed_by)
  VALUES (p_job_id, previous_status, p_status, auth.uid());
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id,
                                before_data, after_data)
  VALUES (auth.uid(), 'status_change', 'job', p_job_id,
          jsonb_build_object('status', previous_status),
          jsonb_build_object('status', p_status));
END $$;

REVOKE ALL ON FUNCTION public.change_legacy_job_status(uuid, public.job_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_legacy_job_status(uuid, public.job_status) TO authenticated;
