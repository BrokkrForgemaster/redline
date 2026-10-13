-- Crew and leader membership must change together. Run staging consistency
-- queries before applying; this migration does not guess at existing leaders.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.crews c
    WHERE (c.leader_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.crew_members m
      WHERE m.crew_id = c.id AND m.employee_id = c.leader_id AND m.role = 'leader'
    )) OR EXISTS (
      SELECT 1 FROM public.crew_members m
      WHERE m.crew_id = c.id AND m.role = 'leader'
        AND m.employee_id IS DISTINCT FROM c.leader_id
    )
  ) THEN
    RAISE EXCEPTION 'Reconcile existing crew leader and membership mismatches before migration 028';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.crews c
    JOIN public.profiles p ON p.id = c.leader_id
    WHERE p.status <> 'active' OR p.role <> 'mowing_crew_lead'
  ) THEN
    RAISE EXCEPTION 'Reconcile inactive or ineligible existing crew leaders before migration 028';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.crew_members m
    JOIN public.profiles p ON p.id = m.employee_id
    WHERE p.status <> 'active' OR
      (m.role = 'leader' AND p.role <> 'mowing_crew_lead') OR
      (m.role = 'member' AND p.role NOT IN
        ('mowing_crew_lead', 'mowing_crew_laborer', 'snow_plow_operator'))
  ) THEN
    RAISE EXCEPTION 'Reconcile inactive or ineligible current crew members before migration 028';
  END IF;
END $$;

CREATE TABLE public.crew_member_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  membership_id uuid NOT NULL,
  crew_id uuid NOT NULL REFERENCES public.crews(id),
  employee_id uuid NOT NULL REFERENCES public.profiles(id),
  role text NOT NULL CHECK (role IN ('leader', 'member')),
  joined_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES public.profiles(id)
);
CREATE INDEX crew_member_history_crew_idx ON public.crew_member_history(crew_id, ended_at DESC);
ALTER TABLE public.crew_member_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads crew membership history" ON public.crew_member_history
  FOR SELECT TO authenticated USING (public.is_owner_or_admin());

CREATE FUNCTION public.validate_current_crew_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE v_status text; v_role public.app_role;
BEGIN
  SELECT status, role INTO v_status, v_role FROM public.profiles WHERE id = NEW.employee_id;
  IF NOT FOUND OR v_status <> 'active' OR
     (NEW.role = 'leader' AND v_role <> 'mowing_crew_lead') OR
     (NEW.role = 'member' AND v_role NOT IN
       ('mowing_crew_lead', 'mowing_crew_laborer', 'snow_plow_operator')) THEN
    RAISE EXCEPTION 'Current crew member must be active eligible field staff' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER current_crew_member_eligibility
  BEFORE INSERT OR UPDATE ON public.crew_members
  FOR EACH ROW EXECUTE FUNCTION public.validate_current_crew_member();

CREATE FUNCTION public.record_crew_membership_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND
     (OLD.crew_id IS DISTINCT FROM NEW.crew_id OR
      OLD.employee_id IS DISTINCT FROM NEW.employee_id) THEN
    RAISE EXCEPTION 'Move crew members by removing and re-adding them' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.crew_member_history
      (membership_id, crew_id, employee_id, role, joined_at, changed_by)
    VALUES (OLD.id, OLD.crew_id, OLD.employee_id, OLD.role, OLD.joined_at, auth.uid());
    RETURN OLD;
  END IF;
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO public.crew_member_history
      (membership_id, crew_id, employee_id, role, joined_at, changed_by)
    VALUES (OLD.id, OLD.crew_id, OLD.employee_id, OLD.role, OLD.joined_at, auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crew_membership_history_before_change
  BEFORE UPDATE OR DELETE ON public.crew_members
  FOR EACH ROW EXECUTE FUNCTION public.record_crew_membership_history();

CREATE FUNCTION public.check_crew_leader_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE checked_crew_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'crews' THEN
    checked_crew_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    checked_crew_id := OLD.crew_id;
  ELSE
    checked_crew_id := NEW.crew_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.crews c WHERE c.id = checked_crew_id
      AND ((c.leader_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.crew_members m
        WHERE m.crew_id = c.id AND m.employee_id = c.leader_id AND m.role = 'leader'
      )) OR EXISTS (
        SELECT 1 FROM public.crew_members m WHERE m.crew_id = c.id
          AND m.role = 'leader' AND m.employee_id IS DISTINCT FROM c.leader_id
      ))
  ) THEN
    RAISE EXCEPTION 'Crew leader must match its leader membership' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER crews_leader_consistency
  AFTER INSERT OR UPDATE ON public.crews DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.check_crew_leader_membership();
CREATE CONSTRAINT TRIGGER crew_members_leader_consistency
  AFTER INSERT OR UPDATE OR DELETE ON public.crew_members DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.check_crew_leader_membership();

CREATE FUNCTION public.apply_crew_change(p_action text, p_crew_id uuid, p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_crew public.crews%ROWTYPE;
  v_id uuid;
  v_employee uuid;
  v_leader uuid;
  v_role text;
  v_name text;
  v_description text;
  v_status text;
  v_profile_role public.app_role;
BEGIN
  IF NOT public.is_owner_or_admin() OR COALESCE(auth.jwt()->>'aal', '') <> 'aal2' THEN
    RAISE EXCEPTION 'Active owner with MFA required' USING ERRCODE = '42501';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid crew payload' USING ERRCODE = '22023';
  END IF;
  IF p_action NOT IN ('create', 'update', 'add_member', 'remove_member', 'deactivate') THEN
    RAISE EXCEPTION 'Invalid crew action' USING ERRCODE = '22023';
  END IF;

  IF p_action = 'create' THEN
    v_name := nullif(btrim(p_payload->>'name'), '');
    IF v_name IS NULL OR length(v_name) > 120 THEN
      RAISE EXCEPTION 'Crew name must contain 1 to 120 characters' USING ERRCODE = '22023';
    END IF;
    v_description := nullif(btrim(p_payload->>'description'), '');
    IF length(v_description) > 1000 THEN
      RAISE EXCEPTION 'Crew description is too long' USING ERRCODE = '22023';
    END IF;
    IF p_payload ? 'leader_id' AND p_payload->>'leader_id' IS NOT NULL THEN
      v_leader := (p_payload->>'leader_id')::uuid;
    END IF;
    INSERT INTO public.crews(name, description, leader_id)
      VALUES (v_name, v_description, v_leader) RETURNING id INTO v_id;
  ELSE
    SELECT * INTO v_crew FROM public.crews WHERE id = p_crew_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Crew not found' USING ERRCODE = 'P0002'; END IF;
    v_id := v_crew.id;
    v_leader := v_crew.leader_id;
  END IF;

  IF p_action = 'update' THEN
    IF p_payload ? 'name' THEN
      v_name := nullif(btrim(p_payload->>'name'), '');
      IF v_name IS NULL OR length(v_name) > 120 THEN
        RAISE EXCEPTION 'Crew name must contain 1 to 120 characters' USING ERRCODE = '22023';
      END IF;
    ELSE v_name := v_crew.name;
    END IF;
    IF p_payload ? 'description' THEN
      v_description := nullif(btrim(p_payload->>'description'), '');
      IF length(v_description) > 1000 THEN
        RAISE EXCEPTION 'Crew description is too long' USING ERRCODE = '22023';
      END IF;
    ELSE v_description := v_crew.description;
    END IF;
    IF p_payload ? 'leader_id' THEN
      v_leader := (p_payload->>'leader_id')::uuid;
    END IF;
    UPDATE public.crews SET name = v_name, description = v_description,
      leader_id = v_leader, updated_at = now() WHERE id = v_id;
  ELSIF p_action = 'add_member' THEN
    v_employee := (p_payload->>'employee_id')::uuid;
    v_role := p_payload->>'role';
    IF v_employee IS NULL OR v_role IS NULL OR v_role NOT IN ('leader', 'member') THEN
      RAISE EXCEPTION 'Invalid crew member' USING ERRCODE = '22023';
    END IF;
    IF NOT v_crew.active THEN RAISE EXCEPTION 'Crew is inactive' USING ERRCODE = '22023'; END IF;
    SELECT status, role INTO v_status, v_profile_role FROM public.profiles
      WHERE id = v_employee;
    IF NOT FOUND OR v_status <> 'active' OR
       (v_role = 'leader' AND v_profile_role <> 'mowing_crew_lead') OR
       (v_role = 'member' AND v_profile_role NOT IN
         ('mowing_crew_lead', 'mowing_crew_laborer', 'snow_plow_operator')) THEN
      RAISE EXCEPTION 'Crew member has an ineligible or inactive staff role' USING ERRCODE = '22023';
    END IF;
    IF v_role = 'leader' THEN
      v_leader := v_employee;
      UPDATE public.crews SET leader_id = v_leader, updated_at = now() WHERE id = v_id;
    ELSE
      INSERT INTO public.crew_members(crew_id, employee_id, role)
        VALUES (v_id, v_employee, 'member');
    END IF;
  ELSIF p_action = 'remove_member' THEN
    v_employee := (p_payload->>'employee_id')::uuid;
    IF v_employee IS NULL THEN RAISE EXCEPTION 'Employee is required' USING ERRCODE = '22023'; END IF;
    IF v_employee = v_crew.leader_id THEN
      UPDATE public.crews SET leader_id = NULL, updated_at = now() WHERE id = v_id;
    END IF;
    DELETE FROM public.crew_members WHERE crew_id = v_id AND employee_id = v_employee;
    IF NOT FOUND THEN RAISE EXCEPTION 'Crew member not found' USING ERRCODE = 'P0002'; END IF;
  ELSIF p_action = 'deactivate' THEN
    IF NOT v_crew.active THEN RAISE EXCEPTION 'Crew already inactive' USING ERRCODE = '22023'; END IF;
    UPDATE public.crews SET active = false, updated_at = now() WHERE id = v_id;
  END IF;

  IF p_action IN ('create', 'update', 'add_member') AND v_leader IS DISTINCT FROM
    CASE WHEN p_action = 'create' THEN NULL::uuid ELSE v_crew.leader_id END THEN
    SELECT status, role INTO v_status, v_profile_role FROM public.profiles
      WHERE id = v_leader;
    IF v_leader IS NOT NULL AND (NOT FOUND OR v_status <> 'active' OR v_profile_role <> 'mowing_crew_lead') THEN
      RAISE EXCEPTION 'Leader must be an active Mowing Crew Lead' USING ERRCODE = '22023';
    END IF;
    UPDATE public.crew_members SET role = 'member'
      WHERE crew_id = v_id AND role = 'leader' AND employee_id IS DISTINCT FROM v_leader;
    IF v_leader IS NOT NULL THEN
      INSERT INTO public.crew_members(crew_id, employee_id, role)
        VALUES (v_id, v_leader, 'leader')
        ON CONFLICT (crew_id, employee_id) DO UPDATE SET role = 'leader';
    END IF;
  END IF;

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data)
    VALUES (auth.uid(), 'crew_' || p_action, 'crew', v_id,
      CASE WHEN p_action = 'create' THEN NULL ELSE to_jsonb(v_crew) END,
      jsonb_build_object('action', p_action, 'payload', p_payload));
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.apply_crew_change(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_crew_change(text, uuid, jsonb) TO authenticated;
