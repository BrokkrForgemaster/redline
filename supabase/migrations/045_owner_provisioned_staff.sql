-- Owner-provisioned accounts replace email invitations. Existing invitation rows
-- remain as history; they cannot activate through the new setup flow.
CREATE TABLE IF NOT EXISTS public.staff_account_setups (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  assigned_role app_role NOT NULL CHECK (assigned_role IN
    ('mowing_crew_lead', 'mowing_crew_laborer', 'snow_plow_operator', 'subcontractor')),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (email = lower(btrim(email))),
  CHECK (char_length(first_name) BETWEEN 1 AND 50),
  CHECK (char_length(last_name) BETWEEN 1 AND 50)
);

ALTER TABLE public.staff_account_setups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner and account holder can read staff setup"
ON public.staff_account_setups FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_owner_or_admin());

CREATE OR REPLACE FUNCTION public.register_staff_account_setup(
  p_user_id uuid, p_email text, p_first_name text, p_last_name text, p_role app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  recent_totp boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(auth.jwt()->'amr', '[]'::jsonb)) AS m(value)
    WHERE m.value->>'method' = 'totp'
      AND m.value->>'timestamp' ~ '^[0-9]+$'
      AND to_timestamp((m.value->>'timestamp')::bigint) >= now() - interval '15 minutes'
      AND to_timestamp((m.value->>'timestamp')::bigint) <= now() + interval '1 minute'
  ) INTO recent_totp;
  IF NOT public.is_owner_or_admin() OR COALESCE(auth.jwt()->>'aal', '') <> 'aal2'
     OR NOT recent_totp THEN
    RAISE EXCEPTION 'Recent owner MFA required' USING ERRCODE = '42501';
  END IF;
  p_email := lower(btrim(p_email));
  p_first_name := btrim(p_first_name);
  p_last_name := btrim(p_last_name);
  IF p_user_id IS NULL OR p_email IS NULL OR p_email !~ '^[^@ ]+@[^@ ]+\.[^@ ]+$'
     OR char_length(p_first_name) NOT BETWEEN 1 AND 50
     OR char_length(p_last_name) NOT BETWEEN 1 AND 50
     OR p_role NOT IN ('mowing_crew_lead', 'mowing_crew_laborer',
                       'snow_plow_operator', 'subcontractor') THEN
    RAISE EXCEPTION 'Invalid staff setup' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u JOIN public.profiles p ON p.id = u.id
    WHERE u.id = p_user_id AND lower(u.email) = p_email
      AND lower(p.email) = p_email AND p.status = 'invited'
      AND p.role NOT IN ('owner', 'developer') AND u.email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Provisioned user and invited profile required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.staff_account_setups
    (user_id, email, first_name, last_name, assigned_role, created_by)
  VALUES (p_user_id, p_email, p_first_name, p_last_name, p_role, auth.uid());
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, after_data)
  VALUES (auth.uid(), 'staff_account_provisioned', 'profile', p_user_id,
    jsonb_build_object('email', p_email, 'role', p_role, 'status', 'invited'));
END $$;

CREATE OR REPLACE FUNCTION public.complete_staff_account_setup(p_user_id uuid)
RETURNS app_role LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  setup public.staff_account_setups%ROWTYPE;
  current_profile public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO setup FROM public.staff_account_setups
    WHERE user_id = p_user_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pending setup required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO current_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND OR current_profile.status <> 'invited'
     OR lower(current_profile.email) <> setup.email
     OR current_profile.role IN ('owner', 'developer')
     OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id
                   AND lower(email) = setup.email AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Setup identity mismatch' USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles SET status = 'active', role = setup.assigned_role,
    first_name = setup.first_name, last_name = setup.last_name,
    updated_at = now() WHERE id = p_user_id;
  UPDATE public.staff_account_setups SET status = 'completed', completed_at = now()
    WHERE user_id = p_user_id;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data)
  VALUES (p_user_id, 'staff_account_setup_completed', 'profile', p_user_id,
    jsonb_build_object('status', current_profile.status, 'role', current_profile.role),
    jsonb_build_object('status', 'active', 'role', setup.assigned_role));
  RETURN setup.assigned_role;
END $$;

REVOKE ALL ON FUNCTION public.register_staff_account_setup(uuid, text, text, text, app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_staff_account_setup(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_staff_account_setup(uuid, text, text, text, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_staff_account_setup(uuid) TO service_role;

-- Retire direct database access to the former invitation commands while
-- retaining historical records and their audit trail.
REVOKE EXECUTE ON FUNCTION public.create_staff_invitation(text, text, text, app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_staff_invitation(uuid) FROM service_role;
