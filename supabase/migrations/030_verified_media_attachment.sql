-- Called only by the server after downloading and fully decoding the private
-- object. Locking the visit makes attachment/finalization races deterministic.
CREATE FUNCTION public.attach_verified_visit_media(
  p_actor_id uuid, p_run_id uuid, p_asset_id uuid, p_byte_size bigint,
  p_sha256_hex text, p_width integer, p_height integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  actor_role public.app_role;
  current_run public.service_runs%ROWTYPE;
  asset public.media_assets%ROWTYPE;
  result jsonb;
BEGIN
  IF p_actor_id IS NULL OR p_run_id IS NULL OR p_asset_id IS NULL OR
     p_byte_size IS NULL OR p_byte_size <= 0 OR p_byte_size > 20 * 1024 * 1024 OR
     p_sha256_hex IS NULL OR p_sha256_hex !~ '^[a-f0-9]{64}$' OR
     p_width IS NULL OR p_width <= 0 OR p_width > 12000 OR
     p_height IS NULL OR p_height <= 0 OR p_height > 12000 OR
     p_width::bigint * p_height::bigint > 50000000 THEN
    RAISE EXCEPTION 'Invalid verified image metadata' USING ERRCODE = '22023';
  END IF;
  SELECT role INTO actor_role FROM public.profiles
    WHERE id = p_actor_id AND status = 'active';
  IF actor_role IS NULL OR actor_role NOT IN
      ('owner', 'mowing_crew_lead', 'mowing_crew_laborer',
       'snow_plow_operator', 'subcontractor') THEN
    RAISE EXCEPTION 'Active field account required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO current_run FROM public.service_runs WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Visit not found' USING ERRCODE = 'P0002'; END IF;
  IF actor_role <> 'owner' AND NOT EXISTS (
    SELECT 1 FROM public.work_order_assignments assignment
    WHERE assignment.work_order_id = current_run.work_order_id AND assignment.active = true
      AND ((assignment.assignment_type = 'employee' AND assignment.employee_id = p_actor_id)
        OR (assignment.assignment_type = 'crew' AND EXISTS (
          SELECT 1 FROM public.crew_members member
          JOIN public.crews crew ON crew.id = member.crew_id AND crew.active = true
          WHERE member.crew_id = assignment.crew_id AND member.employee_id = p_actor_id
        ))
        OR (assignment.assignment_type = 'subcontractor' AND EXISTS (
          SELECT 1 FROM public.subcontractor_memberships membership
          JOIN public.subcontractor_companies company
            ON company.id = membership.subcontractor_company_id AND company.status = 'active'
          WHERE membership.subcontractor_company_id = assignment.subcontractor_company_id
            AND membership.user_id = p_actor_id AND membership.active = true
        )))
  ) THEN
    RAISE EXCEPTION 'Current visit assignment required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO asset FROM public.media_assets
    WHERE id = p_asset_id AND service_run_id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Media asset not found' USING ERRCODE = 'P0002'; END IF;
  IF asset.uploaded_by IS DISTINCT FROM p_actor_id OR
     asset.work_order_id IS DISTINCT FROM current_run.work_order_id OR
     asset.bucket <> 'service-evidence' OR
     asset.object_key NOT LIKE 'service-runs/' || p_run_id || '/%' THEN
    RAISE EXCEPTION 'Media does not belong to this worker and visit' USING ERRCODE = '42501';
  END IF;
  IF asset.status = 'attached' THEN
    IF asset.byte_size IS DISTINCT FROM p_byte_size OR
       (asset.sha256_hex IS NOT NULL AND asset.sha256_hex <> p_sha256_hex) OR
       (asset.width IS NOT NULL AND asset.width <> p_width) OR
       (asset.height IS NOT NULL AND asset.height <> p_height) THEN
      RAISE EXCEPTION 'Attached media changed since verification' USING ERRCODE = '23505';
    END IF;
    IF asset.sha256_hex IS NULL OR asset.width IS NULL OR asset.height IS NULL THEN
      UPDATE public.media_assets SET sha256_hex = p_sha256_hex,
        width = p_width, height = p_height WHERE id = p_asset_id;
    END IF;
  ELSIF asset.status = 'pending_upload' THEN
    IF current_run.status IN ('submitted', 'completed', 'cancelled', 'rejected') OR
       current_run.frozen_at IS NOT NULL THEN
      RAISE EXCEPTION 'Finalized visit requires an audited media amendment' USING ERRCODE = '40001';
    END IF;
    IF asset.evidence_type = 'after' AND current_run.started_at IS NULL THEN
      RAISE EXCEPTION 'After evidence requires a started visit' USING ERRCODE = '40001';
    END IF;
    UPDATE public.media_assets SET status = 'attached', uploaded_at = now(),
      byte_size = p_byte_size, sha256_hex = p_sha256_hex,
      width = p_width, height = p_height WHERE id = p_asset_id;
    INSERT INTO public.audit_events(actor_id, action, entity_type, entity_id, after_data)
    VALUES (p_actor_id, 'visit_media_attached', 'media_asset', p_asset_id,
      jsonb_build_object('service_run_id', p_run_id, 'sha256_hex', p_sha256_hex,
                         'byte_size', p_byte_size));
  ELSE
    RAISE EXCEPTION 'Media is unavailable for attachment' USING ERRCODE = '40001';
  END IF;
  result := jsonb_build_object('asset', jsonb_build_object(
    'id', p_asset_id, 'status', 'attached', 'uploaded_at',
    COALESCE(asset.uploaded_at, now()), 'evidence_type', asset.evidence_type,
    'media_category', asset.media_category));
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.attach_verified_visit_media(
  uuid, uuid, uuid, bigint, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_verified_visit_media(
  uuid, uuid, uuid, bigint, text, integer, integer) TO service_role;
