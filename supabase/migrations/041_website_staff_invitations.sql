-- Owner-controlled staff invitations. No role is read from signup metadata.
CREATE TABLE IF NOT EXISTS public.staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  assigned_role app_role NOT NULL CHECK (assigned_role IN
    ('mowing_crew_lead', 'mowing_crew_laborer', 'snow_plow_operator', 'subcontractor')),
  user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  invited_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  provider_error text,
  CHECK (char_length(first_name) BETWEEN 1 AND 50),
  CHECK (char_length(last_name) BETWEEN 1 AND 50),
  CHECK (email = lower(btrim(email)))
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_invitations_one_pending_email
ON public.staff_invitations(lower(email)) WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS staff_invitations_one_pending_user
ON public.staff_invitations(user_id) WHERE status = 'pending' AND user_id IS NOT NULL;

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active owner can view staff invitations"
ON public.staff_invitations FOR SELECT TO authenticated
USING (public.is_owner_or_admin() AND COALESCE(auth.jwt()->>'aal', '') = 'aal2');

CREATE OR REPLACE FUNCTION public.create_staff_invitation(
  p_email text, p_first_name text, p_last_name text, p_role app_role)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  invitation_id uuid;
  recent_totp boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(auth.jwt()->'amr', '[]'::jsonb)) AS m(value)
    WHERE m.value->>'method' = 'totp'
      AND m.value->>'timestamp' ~ '^[0-9]+$'
      AND to_timestamp((m.value->>'timestamp')::bigint) >= now() - interval '15 minutes'
      AND to_timestamp((m.value->>'timestamp')::bigint) <= now() + interval '1 minute'
  ) INTO recent_totp;
  IF NOT public.is_owner_or_admin()
     OR COALESCE(auth.jwt()->>'aal', '') <> 'aal2'
     OR NOT recent_totp THEN
    RAISE EXCEPTION 'Recent owner MFA required' USING ERRCODE = '42501';
  END IF;
  p_email := lower(btrim(p_email));
  p_first_name := btrim(p_first_name);
  p_last_name := btrim(p_last_name);
  IF p_email IS NULL OR p_email !~ '^[^@ ]+@[^@ ]+\.[^@ ]+$'
     OR char_length(p_first_name) NOT BETWEEN 1 AND 50
     OR char_length(p_last_name) NOT BETWEEN 1 AND 50
     OR p_role NOT IN ('mowing_crew_lead', 'mowing_crew_laborer',
                       'snow_plow_operator', 'subcontractor') THEN
    RAISE EXCEPTION 'Invalid staff invitation' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.staff_invitations(email, first_name, last_name, assigned_role, invited_by)
    VALUES (p_email, p_first_name, p_last_name, p_role, auth.uid())
    RETURNING id INTO invitation_id;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, after_data)
  VALUES (auth.uid(), 'staff_invitation_created', 'staff_invitation', invitation_id,
    jsonb_build_object('email', p_email, 'role', p_role));
  RETURN invitation_id;
END $$;

CREATE OR REPLACE FUNCTION public.accept_staff_invitation(p_user_id uuid)
RETURNS app_role LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  invitation public.staff_invitations%ROWTYPE;
  current_profile public.profiles%ROWTYPE;
  auth_email text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Invited user required' USING ERRCODE = '22023';
  END IF;
  SELECT lower(email) INTO auth_email FROM auth.users
    WHERE id = p_user_id AND email_confirmed_at IS NOT NULL;
  IF auth_email IS NULL THEN
    RAISE EXCEPTION 'Verified invitation email required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO invitation FROM public.staff_invitations
    WHERE user_id = p_user_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND OR invitation.expires_at <= now() OR invitation.email <> auth_email THEN
    RAISE EXCEPTION 'Invitation unavailable or expired' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO current_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND OR current_profile.status <> 'invited'
     OR lower(current_profile.email) <> invitation.email
     OR current_profile.role IN ('owner', 'developer') THEN
    RAISE EXCEPTION 'Invited profile mismatch' USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles SET status = 'active', role = invitation.assigned_role,
    first_name = invitation.first_name, last_name = invitation.last_name,
    updated_at = now() WHERE id = p_user_id;
  UPDATE public.staff_invitations SET status = 'accepted', accepted_at = now()
    WHERE id = invitation.id;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data)
  VALUES (p_user_id, 'staff_invitation_accepted', 'profile', p_user_id,
    jsonb_build_object('status', current_profile.status, 'role', current_profile.role),
    jsonb_build_object('status', 'active', 'role', invitation.assigned_role));
  RETURN invitation.assigned_role;
END $$;

REVOKE ALL ON FUNCTION public.accept_staff_invitation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_staff_invitation(text, text, text, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_staff_invitation(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_staff_invitation(text, text, text, app_role) TO authenticated;
