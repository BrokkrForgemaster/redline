-- Canonical start/finish commits the visit, GPS, event, inbox and delivery
-- intent together. This migration is additive; rehearse against staging data.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS source_event_id uuid REFERENCES public.service_run_events(id);
CREATE UNIQUE INDEX IF NOT EXISTS notifications_workflow_event_recipient_unique
  ON public.notifications(source_event_id, user_id) WHERE source_event_id IS NOT NULL;

CREATE TABLE public.workflow_delivery_outbox (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_event_id uuid NOT NULL REFERENCES public.service_run_events(id) ON DELETE RESTRICT,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  channel text NOT NULL CHECK (channel IN ('push', 'email')),
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'sending', 'delivered', 'retry', 'disabled', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error_class text,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_event_id, recipient_id, channel)
);
CREATE INDEX workflow_delivery_due_idx ON public.workflow_delivery_outbox(state, next_retry_at)
  WHERE state IN ('pending', 'retry');
ALTER TABLE public.workflow_delivery_outbox ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.apply_visit_start_finish(
  p_run_id uuid, p_work_order_id uuid, p_action text, p_key uuid,
  p_latitude numeric, p_longitude numeric, p_accuracy_meters numeric,
  p_captured_at_device timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  actor_id uuid := auth.uid();
  actor_role public.app_role;
  current_run public.service_runs%ROWTYPE;
  current_order public.work_orders%ROWTYPE;
  idem public.idempotency_keys%ROWTYPE;
  fingerprint text;
  distance_meters numeric;
  radius_meters numeric;
  event_id uuid;
  recipient_id uuid;
  event_time timestamptz := now();
  location_source text;
  warning text;
  result jsonb;
BEGIN
  IF actor_id IS NULL OR p_run_id IS NULL OR p_work_order_id IS NULL OR p_key IS NULL OR
     p_action IS NULL OR p_action NOT IN ('start', 'finish') THEN
    RAISE EXCEPTION 'Invalid visit command' USING ERRCODE = '22023';
  END IF;
  SELECT role INTO actor_role FROM public.profiles
    WHERE id = actor_id AND status = 'active';
  IF actor_role IS NULL OR actor_role NOT IN
      ('owner', 'mowing_crew_lead', 'mowing_crew_laborer',
       'snow_plow_operator', 'subcontractor') THEN
    RAISE EXCEPTION 'Active operational account required' USING ERRCODE = '42501';
  END IF;
  IF p_latitude IS NULL OR p_latitude < -90 OR p_latitude > 90 OR
     p_longitude IS NULL OR p_longitude < -180 OR p_longitude > 180 OR
     p_accuracy_meters IS NULL OR p_accuracy_meters < 0 OR p_accuracy_meters > 75 OR
     p_captured_at_device IS NULL OR
     p_captured_at_device > event_time + interval '5 minutes' OR
     p_captured_at_device < event_time - interval '30 days' THEN
    RAISE EXCEPTION 'A plausible GPS fix with acceptable accuracy is required'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO current_run FROM public.service_runs
    WHERE id = p_run_id AND work_order_id = p_work_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Visit not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO current_order FROM public.work_orders
    WHERE id = current_run.work_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Work order not found' USING ERRCODE = 'P0002'; END IF;

  IF actor_role <> 'owner' AND NOT EXISTS (
    SELECT 1 FROM public.work_order_assignments assignment
    WHERE assignment.work_order_id = current_run.work_order_id AND assignment.active = true
      AND ((assignment.assignment_type = 'employee' AND assignment.employee_id = actor_id)
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
        )))
  ) THEN
    RAISE EXCEPTION 'Current visit assignment required' USING ERRCODE = '42501';
  END IF;

  fingerprint := encode(digest(jsonb_build_object(
    'run', p_run_id, 'work_order', p_work_order_id, 'action', p_action,
    'latitude', p_latitude, 'longitude', p_longitude,
    'accuracy_meters', p_accuracy_meters,
    'captured_at_device', p_captured_at_device)::text, 'sha256'), 'hex');
  INSERT INTO public.idempotency_keys(key, user_id, scope, request_hash, locked_until)
    VALUES (p_key, actor_id, 'service-runs:' || p_run_id || ':' || p_action,
            fingerprint, event_time + interval '60 seconds')
    ON CONFLICT (user_id, scope, key) DO NOTHING;
  SELECT * INTO idem FROM public.idempotency_keys
    WHERE user_id = actor_id AND scope = 'service-runs:' || p_run_id || ':' || p_action
      AND key = p_key FOR UPDATE;
  IF idem.request_hash IS DISTINCT FROM fingerprint THEN
    RAISE EXCEPTION 'Idempotency key reused with different input' USING ERRCODE = '23505';
  END IF;
  IF idem.completed_at IS NOT NULL THEN RETURN idem.response_body; END IF;
  IF idem.created_at < event_time - interval '60 seconds' THEN
    RAISE EXCEPTION 'Old unfinished command requires reconciliation' USING ERRCODE = '40001';
  END IF;

  IF p_action = 'start' THEN
    IF current_run.status <> 'ready' OR current_run.started_at IS NOT NULL OR
       current_order.status NOT IN
         ('scheduled', 'assigned', 'ready', 'in_progress', 'paused', 'submitted', 'needs_review') THEN
      RAISE EXCEPTION 'Visit cannot be started from its current state' USING ERRCODE = '40001';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.location_events tag WHERE tag.service_run_id = p_run_id
        AND tag.event_type = 'geofence_check' AND tag.result = 'on_site'
        AND tag.id = (SELECT recent.id FROM public.location_events recent
          WHERE recent.service_run_id = p_run_id AND recent.event_type = 'geofence_check'
          ORDER BY recent.received_at_server DESC, recent.id DESC LIMIT 1)
    ) THEN
      RAISE EXCEPTION 'Current visit site tag is required' USING ERRCODE = '23514';
    END IF;
    IF (SELECT count(DISTINCT asset.id) FROM public.media_assets asset
        WHERE asset.service_run_id = p_run_id AND asset.work_order_id = p_work_order_id
          AND asset.status = 'attached' AND asset.evidence_type = 'before') < 3 THEN
      RAISE EXCEPTION 'Three attached before photos are required' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF current_run.status NOT IN ('in_progress', 'paused') OR
       current_run.started_at IS NULL OR current_run.finished_at IS NOT NULL THEN
      RAISE EXCEPTION 'Visit cannot be finished from its current state' USING ERRCODE = '40001';
    END IF;
    IF (SELECT count(DISTINCT asset.id) FROM public.media_assets asset
        WHERE asset.service_run_id = p_run_id AND asset.work_order_id = p_work_order_id
          AND asset.status = 'attached' AND asset.evidence_type = 'after') < 3 THEN
      RAISE EXCEPTION 'Three attached after photos are required' USING ERRCODE = '23514';
    END IF;
    IF current_run.template_version_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.checklist_items item
      JOIN public.checklist_sections section ON section.id = item.section_id
      WHERE section.template_version_id = current_run.template_version_id
        AND item.required = true AND NOT EXISTS (
          SELECT 1 FROM public.checklist_responses response
          WHERE response.service_run_id = p_run_id
            AND response.checklist_item_id = item.id AND response.completed = true
        )
    ) THEN
      RAISE EXCEPTION 'Required checklist items are incomplete' USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT ST_Distance(property.geo,
      ST_SetSRID(ST_MakePoint(p_longitude::double precision,
                             p_latitude::double precision), 4326)::geography),
      property.geofence_radius_meters
    INTO distance_meters, radius_meters
  FROM public.properties property WHERE property.id = current_order.property_id;
  IF distance_meters IS NULL OR radius_meters IS NULL OR distance_meters > radius_meters THEN
    RAISE EXCEPTION 'Current GPS fix is outside the configured site' USING ERRCODE = '23514';
  END IF;
  location_source := CASE WHEN p_captured_at_device < event_time - interval '10 minutes'
    THEN 'offline_synced' ELSE 'online' END;
  warning := CASE WHEN p_accuracy_meters > 30 THEN 'GPS accuracy is acceptable with warning.'
    ELSE NULL END;

  IF p_action = 'start' THEN
    UPDATE public.service_runs SET status = 'in_progress', started_at = event_time,
      primary_worker_id = actor_id, version_number = version_number + 1,
      updated_at = event_time WHERE id = p_run_id;
    UPDATE public.work_orders SET status = 'in_progress', updated_at = event_time,
      updated_by = actor_id WHERE id = p_work_order_id;
  ELSE
    UPDATE public.service_runs SET status = 'completed', finished_at = event_time,
      frozen_at = event_time, version_number = version_number + 1,
      updated_at = event_time WHERE id = p_run_id;
    -- Completing this visit does not close a multi-day project or recurrence.
  END IF;
  INSERT INTO public.location_events(
    service_run_id, work_order_id, actor_id, event_type, latitude, longitude,
    accuracy_meters, captured_at_device, distance_meters,
    configured_radius_meters, result, source)
  VALUES (p_run_id, p_work_order_id, actor_id, p_action, p_latitude, p_longitude,
          p_accuracy_meters, p_captured_at_device, distance_meters,
          radius_meters, 'on_site', location_source);
  INSERT INTO public.service_run_events(
    service_run_id, event_type, actor_id, from_status, to_status, metadata)
  VALUES (p_run_id, p_action, actor_id, current_run.status,
          CASE WHEN p_action = 'start' THEN 'in_progress'::service_run_status
               ELSE 'completed'::service_run_status END,
          jsonb_build_object('distance_meters', distance_meters,
                             'configured_radius_meters', radius_meters))
  RETURNING id INTO event_id;
  INSERT INTO public.audit_events(actor_id, action, entity_type, entity_id,
                                  before_data, after_data)
  VALUES (actor_id, 'visit_' || p_action, 'service_run', p_run_id,
          jsonb_build_object('status', current_run.status,
                             'version_number', current_run.version_number),
          jsonb_build_object('status', CASE WHEN p_action = 'start' THEN 'in_progress'
                                                   ELSE 'completed' END,
                             'version_number', current_run.version_number + 1));

  FOR recipient_id IN
    SELECT DISTINCT scoped.id FROM (
      SELECT owner_profile.id FROM public.profiles owner_profile
        WHERE owner_profile.role = 'owner' AND owner_profile.status = 'active'
      UNION
      SELECT leader.id FROM public.work_order_assignments assignment
        JOIN public.crews crew ON crew.id = assignment.crew_id AND crew.active = true
        JOIN public.profiles leader ON leader.id = crew.leader_id AND leader.status = 'active'
        WHERE assignment.work_order_id = p_work_order_id AND assignment.active = true
          AND assignment.assignment_type = 'crew'
      UNION
      SELECT supervisor.user_id FROM public.work_order_assignments assignment
        JOIN public.subcontractor_memberships supervisor
          ON supervisor.subcontractor_company_id = assignment.subcontractor_company_id
          AND supervisor.active = true AND supervisor.role IN ('owner', 'manager')
        JOIN public.profiles supervisor_profile
          ON supervisor_profile.id = supervisor.user_id AND supervisor_profile.status = 'active'
        JOIN public.subcontractor_companies company
          ON company.id = assignment.subcontractor_company_id AND company.status = 'active'
        WHERE assignment.work_order_id = p_work_order_id AND assignment.active = true
          AND assignment.assignment_type = 'subcontractor'
    ) scoped WHERE scoped.id IS NOT NULL AND scoped.id <> actor_id
  LOOP
    INSERT INTO public.notifications(user_id, type, title, body, action_url,
                                     entity_type, entity_id, source_event_id)
    VALUES (recipient_id, 'service_run_' || p_action,
            CASE WHEN p_action = 'start' THEN 'Visit started' ELSE 'Visit finished' END,
            'An assigned service visit changed.', '/service-runs/' || p_run_id,
            'service_run', p_run_id, event_id);
    INSERT INTO public.workflow_delivery_outbox(source_event_id, recipient_id, channel)
    VALUES (event_id, recipient_id, 'push');
  END LOOP;

  result := jsonb_build_object(
    'service_run', jsonb_build_object('id', p_run_id,
      'status', CASE WHEN p_action = 'start' THEN 'in_progress' ELSE 'completed' END,
      'started_at', CASE WHEN p_action = 'start' THEN event_time ELSE current_run.started_at END,
      'finished_at', CASE WHEN p_action = 'finish' THEN event_time ELSE NULL END,
      'version_number', current_run.version_number + 1),
    'geofence', jsonb_build_object('result', 'on_site',
      'distance_meters', distance_meters, 'configured_radius_meters', radius_meters,
      'warning', warning));
  UPDATE public.idempotency_keys SET response_status = CASE WHEN p_action = 'start' THEN 201 ELSE 200 END,
    response_body = result, completed_at = event_time, locked_until = NULL
  WHERE id = idem.id;
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.apply_visit_start_finish(
  uuid, uuid, text, uuid, numeric, numeric, numeric, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_visit_start_finish(
  uuid, uuid, text, uuid, numeric, numeric, numeric, timestamptz) TO authenticated;
