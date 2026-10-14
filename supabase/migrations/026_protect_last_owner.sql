-- A self-service profile update must not remove the only active Admin.
CREATE OR REPLACE FUNCTION public.protect_last_active_owner()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.role = 'owner' AND OLD.status = 'active'
     AND (NEW.role <> 'owner' OR NEW.status <> 'active') THEN
    PERFORM pg_advisory_xact_lock(hashtext('redline:last-active-owner'));
    IF (SELECT count(*) FROM public.profiles
        WHERE role = 'owner' AND status = 'active') <= 1 THEN
      RAISE EXCEPTION 'The last active owner cannot be removed' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_last_active_owner_on_update ON public.profiles;
CREATE TRIGGER protect_last_active_owner_on_update
BEFORE UPDATE OF role, status ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_last_active_owner();

-- The original self-update policy compared roles but did not prevent a user
-- from changing their own status or customer identity.
DROP POLICY IF EXISTS "Users can update their own non-role fields" ON public.profiles;
CREATE POLICY "Active users can update own safe profile"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() AND status = 'active')
WITH CHECK (id = auth.uid() AND status = 'active'
            AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

CREATE OR REPLACE FUNCTION public.protect_self_profile_access_fields()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() = OLD.id AND NOT public.is_owner_or_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.mfa_enabled IS DISTINCT FROM OLD.mfa_enabled
       OR NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
      RAISE EXCEPTION 'Profile access fields cannot be self-edited' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_self_profile_access_fields_on_update ON public.profiles;
CREATE TRIGGER protect_self_profile_access_fields_on_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_self_profile_access_fields();
