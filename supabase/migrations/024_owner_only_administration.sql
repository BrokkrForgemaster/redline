-- Owner decision, October 12, 2026: the single active legacy crew_member is
-- a Mowing Crew Laborer. Any other active legacy role still needs review.
DO $$
DECLARE
  legacy_member_id uuid;
  legacy_member_count integer;
BEGIN
  LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;
  IF (SELECT count(*) FROM public.profiles
      WHERE status = 'active' AND role = 'owner') <> 1 THEN
    RAISE EXCEPTION 'Exactly one active owner profile is required; reconcile owner accounts before migration 024';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE status = 'active'
      AND role IN ('administrator', 'operations_manager', 'office_manager',
                   'estimator', 'snow_operations_manager', 'inventory_manager',
                   'bookkeeper', 'read_only', 'crew_leader')
  ) THEN
    RAISE EXCEPTION 'Active legacy roles require owner-approved mapping before migration 024';
  END IF;
  SELECT count(*) INTO legacy_member_count
  FROM public.profiles WHERE status = 'active' AND role = 'crew_member';
  IF legacy_member_count = 1 THEN
    SELECT id INTO legacy_member_id FROM public.profiles
      WHERE status = 'active' AND role = 'crew_member' FOR UPDATE;
    UPDATE public.profiles
      SET role = 'mowing_crew_laborer', updated_at = now()
      WHERE id = legacy_member_id AND status = 'active' AND role = 'crew_member';
    INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data, metadata)
    VALUES (NULL, 'approved_legacy_role_mapping', 'profile', legacy_member_id,
      '{"role":"crew_member"}'::jsonb, '{"role":"mowing_crew_laborer"}'::jsonb,
      '{"plan":"Redline implementation plan section 3","owner_decision":"2026-10-12"}'::jsonb);
  ELSIF legacy_member_count = 0 AND EXISTS (
    SELECT 1 FROM public.audit_logs a JOIN public.profiles p ON p.id = a.entity_id
    WHERE a.action = 'approved_legacy_role_mapping'
      AND a.entity_type = 'profile' AND p.role = 'mowing_crew_laborer'
      AND a.before_data->>'role' = 'crew_member'
  ) THEN
    NULL; -- A prior attempt completed the audited mapping; continue safely.
  ELSE
    RAISE EXCEPTION 'Expected exactly one active legacy crew_member approved as Mowing Crew Laborer';
  END IF;
END $$;

-- Historical role names remain in the enum for archived rows and old clients,
-- but no longer carry permissions. Technical support has no business grants.
DELETE FROM public.role_permissions WHERE role <> 'owner';

-- Compatibility for older RLS policies that compare auth_role() to crew roles.
-- The profile keeps its precise business role; this helper never maps Developer.
CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT CASE role
    WHEN 'mowing_crew_lead' THEN 'crew_leader'::app_role
    WHEN 'mowing_crew_laborer' THEN 'crew_member'::app_role
    WHEN 'snow_plow_operator' THEN 'crew_member'::app_role
    WHEN 'subcontractor' THEN 'crew_member'::app_role
    ELSE role
  END
  FROM public.profiles WHERE id = auth.uid() AND status = 'active'
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  -- Legacy policies often use is_staff() as an all-rows grant. Until each is
  -- replaced with assignment scope, only Admin can satisfy that predicate.
  SELECT EXISTS (SELECT 1 FROM public.profiles
                 WHERE id = auth.uid() AND status = 'active' AND role = 'owner')
$$;

CREATE OR REPLACE FUNCTION public.has_current_business_account()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'active'
      AND role IN ('owner', 'mowing_crew_lead', 'mowing_crew_laborer',
                   'snow_plow_operator', 'subcontractor', 'customer'))
$$;

-- Older permissive assignment policies omit current-account checks. A
-- restrictive policy closes that gap without granting access by itself.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'customers', 'properties', 'crews', 'crew_members', 'jobs', 'job_assignments',
    'work_orders', 'work_order_assignments', 'service_runs', 'service_run_events',
    'location_events', 'media_assets', 'service_notes', 'service_issues',
    'job_location_tags', 'job_photos'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.has_current_business_account()) WITH CHECK (public.has_current_business_account())',
        'Current business account required', table_name);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.is_owner_or_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'active' AND role = 'owner'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_financial_role()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT public.is_owner_or_admin()
$$;

CREATE OR REPLACE FUNCTION public.can_manage_field_work()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT public.is_owner_or_admin()
$$;

-- Existing policies with explicit legacy role lists cannot authorize active
-- holders because the precondition above requires those roles to be resolved.
-- The new role permissions and service-role routes still need staging RLS tests.

CREATE OR REPLACE FUNCTION public.change_staff_role(p_profile_id uuid, p_role app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  old_role app_role;
  target_status text;
BEGIN
  IF NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'Owner access required' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(auth.jwt()->>'aal', '') <> 'aal2'
     OR to_timestamp(COALESCE((auth.jwt()->>'iat')::bigint, 0)) < now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'Recent MFA authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('mowing_crew_lead', 'mowing_crew_laborer',
                    'snow_plow_operator', 'subcontractor') THEN
    RAISE EXCEPTION 'Invalid staff role' USING ERRCODE = '22023';
  END IF;
  SELECT role, status INTO old_role, target_status
  FROM public.profiles WHERE id = p_profile_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;
  IF old_role IN ('owner', 'developer') THEN
    RAISE EXCEPTION 'Owner and developer roles require a separate controlled process' USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles SET role = p_role, updated_at = now() WHERE id = p_profile_id;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data)
  VALUES (auth.uid(), 'staff_role_changed', 'profile', p_profile_id,
          jsonb_build_object('role', old_role, 'status', target_status),
          jsonb_build_object('role', p_role, 'status', target_status));
END $$;

REVOKE ALL ON FUNCTION public.change_staff_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_staff_role(uuid, app_role) TO authenticated;
