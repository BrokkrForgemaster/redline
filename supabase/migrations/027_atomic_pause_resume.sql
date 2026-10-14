-- Pause/resume commands commit state, event, audit, and idempotency together.
-- Start/finish require separate GPS/evidence validation and are not switched by
-- this migration.
CREATE OR REPLACE FUNCTION public.apply_visit_pause_resume(
  p_run_id uuid,
  p_action text,
  p_key uuid,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  actor_id uuid := auth.uid();
  actor_role app_role;
  current_run public.service_runs%ROWTYPE;
  idempotency public.idempotency_keys%ROWTYPE;
  expected_status service_run_status;
  next_status service_run_status;
  normalized_reason text := NULLIF(btrim(p_reason), '');
  fingerprint text;
  result jsonb;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO actor_role FROM public.profiles
    WHERE id = actor_id AND status = 'active';
  IF actor_role IS NULL OR actor_role NOT IN
      ('owner', 'mowing_crew_lead', 'mowing_crew_laborer',
       'snow_plow_operator', 'subcontractor') THEN
    RAISE EXCEPTION 'Active operational account required' USING ERRCODE = '42501';
  END IF;
  IF p_run_id IS NULL OR p_key IS NULL OR p_action NOT IN ('pause', 'resume')
     OR length(COALESCE(p_reason, '')) > 500 THEN
    RAISE EXCEPTION 'Invalid visit command' USING ERRCODE = '22023';
  END IF;

  fingerprint := encode(digest(
    jsonb_build_object('action', p_action, 'reason', normalized_reason)::text,
    'sha256'), 'hex');

  INSERT INTO public.idempotency_keys(key, user_id, scope, request_hash, locked_until)
  VALUES (p_key, actor_id, 'service-runs:' || p_run_id || ':' || p_action,
          fingerprint, now() + interval '60 seconds')
  ON CONFLICT (user_id, scope, key) DO NOTHING;

  SELECT * INTO idempotency FROM public.idempotency_keys
  WHERE user_id = actor_id
    AND scope = 'service-runs:' || p_run_id || ':' || p_action
    AND key = p_key FOR UPDATE;
  IF idempotency.request_hash IS DISTINCT FROM fingerprint THEN
    RAISE EXCEPTION 'Idempotency key reused with different input' USING ERRCODE = '23505';
  END IF;
  IF idempotency.completed_at IS NOT NULL THEN
    RETURN idempotency.response_body;
  END IF;
  IF idempotency.created_at < now() - interval '60 seconds' THEN
    RAISE EXCEPTION 'Old unfinished command requires reconciliation' USING ERRCODE = '40001';
  END IF;

  SELECT * INTO current_run FROM public.service_runs
  WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visit not found' USING ERRCODE = 'P0002';
  END IF;

  IF actor_role <> 'owner' AND NOT EXISTS (
    SELECT 1 FROM public.work_order_assignments assignment
    WHERE assignment.work_order_id = current_run.work_order_id
      AND assignment.active = true
      AND (
        (assignment.assignment_type = 'employee' AND assignment.employee_id = actor_id)
        OR (assignment.assignment_type = 'crew' AND EXISTS (
          SELECT 1 FROM public.crew_members member
          JOIN public.crews crew ON crew.id = member.crew_id AND crew.active = true
          WHERE member.crew_id = assignment.crew_id AND member.employee_id = actor_id
        ))
        OR (assignment.assignment_type = 'subcontractor' AND EXISTS (
          SELECT 1 FROM public.subcontractor_memberships membership
          JOIN public.subcontractor_companies company
            ON company.id = membership.subcontractor_company_id AND company.status = 'active'
          WHERE membership.subcontractor_company_id = assignment.subcontractor_company_id
            AND membership.user_id = actor_id AND membership.active = true
        ))
      )
  ) THEN
    RAISE EXCEPTION 'Current visit assignment required' USING ERRCODE = '42501';
  END IF;

  expected_status := CASE WHEN p_action = 'pause' THEN 'in_progress'::service_run_status
                          ELSE 'paused'::service_run_status END;
  next_status := CASE WHEN p_action = 'pause' THEN 'paused'::service_run_status
                      ELSE 'in_progress'::service_run_status END;
  IF current_run.status <> expected_status THEN
    RAISE EXCEPTION 'Visit state changed; refresh before retrying' USING ERRCODE = '40001';
  END IF;

  UPDATE public.service_runs
  SET status = next_status, version_number = version_number + 1, updated_at = now()
  WHERE id = p_run_id;
  INSERT INTO public.service_run_events(
    service_run_id, event_type, actor_id, from_status, to_status, metadata)
  VALUES (p_run_id, p_action, actor_id, expected_status, next_status,
          jsonb_build_object('reason', normalized_reason));
  INSERT INTO public.audit_events(
    actor_id, action, entity_type, entity_id, before_data, after_data)
  VALUES (actor_id, 'visit_' || p_action, 'service_run', p_run_id,
          jsonb_build_object('status', expected_status, 'version_number', current_run.version_number),
          jsonb_build_object('status', next_status, 'version_number', current_run.version_number + 1));

  result := jsonb_build_object('service_run', jsonb_build_object(
    'id', p_run_id, 'status', next_status,
    'version_number', current_run.version_number + 1));
  UPDATE public.idempotency_keys
  SET response_status = 200, response_body = result,
      completed_at = now(), locked_until = NULL
  WHERE id = idempotency.id;
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.apply_visit_pause_resume(uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_visit_pause_resume(uuid, text, uuid, text) TO authenticated;
