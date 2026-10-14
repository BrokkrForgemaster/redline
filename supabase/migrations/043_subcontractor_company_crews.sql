-- Owner-managed subcontractor companies and company-scoped crews.
-- Existing Redline crews retain NULL company identity. No existing rows move.
ALTER TABLE public.crews ADD COLUMN IF NOT EXISTS subcontractor_company_id uuid
  REFERENCES public.subcontractor_companies(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS crews_subcontractor_company_idx
  ON public.crews(subcontractor_company_id) WHERE subcontractor_company_id IS NOT NULL;
ALTER TABLE public.crews ADD CONSTRAINT subcontractor_crew_has_no_redline_leader
  CHECK (subcontractor_company_id IS NULL OR leader_id IS NULL);

CREATE POLICY "Active owner reads subcontractor companies"
  ON public.subcontractor_companies FOR SELECT TO authenticated
  USING (public.is_owner_or_admin() AND COALESCE(auth.jwt()->>'aal', '') = 'aal2');
CREATE POLICY "Active owner reads subcontractor memberships"
  ON public.subcontractor_memberships FOR SELECT TO authenticated
  USING (public.is_owner_or_admin() AND COALESCE(auth.jwt()->>'aal', '') = 'aal2');
CREATE POLICY "Active subcontractor reads own membership"
  ON public.subcontractor_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND active AND COALESCE(auth.jwt()->>'aal', '') = 'aal2'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
      AND p.role = 'subcontractor' AND p.status = 'active'));
CREATE POLICY "Active subcontractor reads own company"
  ON public.subcontractor_companies FOR SELECT TO authenticated
  USING (status = 'active' AND COALESCE(auth.jwt()->>'aal', '') = 'aal2'
    AND EXISTS (SELECT 1 FROM public.profiles p
      JOIN public.subcontractor_memberships m ON m.user_id = p.id AND m.active
      WHERE p.id = auth.uid() AND p.role = 'subcontractor' AND p.status = 'active'
        AND m.subcontractor_company_id = subcontractor_companies.id));

CREATE OR REPLACE FUNCTION public.manage_subcontractor_company(
  p_action text, p_company_id uuid, p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE v_id uuid; v_user uuid; v_name text; v_status text;
  v_role public.app_role; v_membership_role text;
BEGIN
  IF NOT public.is_owner_or_admin() OR COALESCE(auth.jwt()->>'aal', '') <> 'aal2' THEN
    RAISE EXCEPTION 'Active Admin with MFA required' USING ERRCODE = '42501';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid company payload' USING ERRCODE = '22023';
  END IF;
  IF p_action = 'create' THEN
    v_name := nullif(btrim(p_payload->>'name'), '');
    IF v_name IS NULL OR length(v_name) > 120 OR p_company_id IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid company name' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.subcontractor_companies(name) VALUES (v_name) RETURNING id INTO v_id;
  ELSIF p_action = 'add_member' THEN
    v_user := (p_payload->>'user_id')::uuid;
    v_membership_role := p_payload->>'membership_role';
    IF v_membership_role IS NULL OR v_membership_role NOT IN ('owner', 'manager', 'member') THEN
      RAISE EXCEPTION 'Valid company membership role required' USING ERRCODE = '22023';
    END IF;
    IF v_user IS NULL OR p_company_id IS NULL THEN
      RAISE EXCEPTION 'Company and user required' USING ERRCODE = '22023';
    END IF;
    SELECT id INTO v_id FROM public.subcontractor_companies
      WHERE id = p_company_id AND status = 'active' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Active company not found' USING ERRCODE = 'P0002'; END IF;
    SELECT status, role INTO v_status, v_role FROM public.profiles WHERE id = v_user FOR UPDATE;
    IF NOT FOUND OR v_status <> 'active' OR v_role <> 'subcontractor' THEN
      RAISE EXCEPTION 'Active Subcontractor account required' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.subcontractor_memberships(subcontractor_company_id, user_id, role, active)
      VALUES (v_id, v_user, v_membership_role, true)
      ON CONFLICT (subcontractor_company_id, user_id) DO UPDATE
        SET active = true, role = EXCLUDED.role;
  ELSE
    RAISE EXCEPTION 'Invalid company action' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, after_data)
    VALUES (auth.uid(), 'subcontractor_company_' || p_action, 'subcontractor_company', v_id,
      jsonb_build_object('action', p_action, 'payload', p_payload));
  RETURN v_id;
END $$;

-- The visit command already routes direct company assignments. A company
-- crew assignment also needs its company supervisor in the same transaction.
CREATE FUNCTION public.notify_subcontractor_crew_supervisors()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE recipient_id uuid; run_work_order_id uuid;
BEGIN
  IF NEW.event_type NOT IN ('start', 'finish') THEN RETURN NEW; END IF;
  SELECT work_order_id INTO run_work_order_id FROM public.service_runs WHERE id = NEW.service_run_id;
  FOR recipient_id IN
    SELECT DISTINCT membership.user_id
    FROM public.work_order_assignments assignment
    JOIN public.crews crew ON crew.id = assignment.crew_id
      AND crew.active AND crew.subcontractor_company_id IS NOT NULL
    JOIN public.subcontractor_companies company
      ON company.id = crew.subcontractor_company_id AND company.status = 'active'
    JOIN public.subcontractor_memberships membership
      ON membership.subcontractor_company_id = company.id
      AND membership.active AND membership.role IN ('owner', 'manager')
    JOIN public.profiles profile ON profile.id = membership.user_id
      AND profile.role = 'subcontractor' AND profile.status = 'active'
    WHERE assignment.work_order_id = run_work_order_id AND assignment.active
      AND assignment.assignment_type = 'crew' AND membership.user_id <> NEW.actor_id
      AND NOT EXISTS (SELECT 1 FROM public.work_order_assignments direct_company
        WHERE direct_company.work_order_id = run_work_order_id
          AND direct_company.assignment_type = 'subcontractor'
          AND direct_company.subcontractor_company_id = company.id
          AND direct_company.active)
  LOOP
    INSERT INTO public.notifications(user_id, type, title, body, action_url,
      entity_type, entity_id, source_event_id)
    VALUES (recipient_id, 'service_run_' || NEW.event_type,
      CASE WHEN NEW.event_type = 'start' THEN 'Visit started' ELSE 'Visit finished' END,
      'An assigned service visit changed.', '/service-runs/' || NEW.service_run_id,
      'service_run', NEW.service_run_id, NEW.id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.workflow_delivery_outbox(source_event_id, recipient_id, channel)
      VALUES (NEW.id, recipient_id, 'push') ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER subcontractor_crew_visit_alerts
  AFTER INSERT ON public.service_run_events FOR EACH ROW
  EXECUTE FUNCTION public.notify_subcontractor_crew_supervisors();

-- Revocation removes current crew access while the existing history trigger
-- retains the former member and actor for audit.
CREATE FUNCTION public.revoke_subcontractor_crew_memberships()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME = 'subcontractor_memberships' THEN
    IF TG_OP = 'DELETE' THEN
      DELETE FROM public.crew_members cm USING public.crews c
        WHERE cm.crew_id = c.id AND c.subcontractor_company_id = OLD.subcontractor_company_id
          AND cm.employee_id = OLD.user_id;
    ELSIF OLD.active AND NOT NEW.active THEN
      DELETE FROM public.crew_members cm USING public.crews c
        WHERE cm.crew_id = c.id AND c.subcontractor_company_id = OLD.subcontractor_company_id
          AND cm.employee_id = OLD.user_id;
    END IF;
  ELSIF OLD.status = 'active' AND NEW.status <> 'active' THEN
    DELETE FROM public.crew_members cm USING public.crews c
      WHERE cm.crew_id = c.id AND c.subcontractor_company_id = NEW.id;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER subcontractor_membership_revokes_crews
  AFTER UPDATE OF active OR DELETE ON public.subcontractor_memberships
  FOR EACH ROW EXECUTE FUNCTION public.revoke_subcontractor_crew_memberships();
CREATE TRIGGER subcontractor_company_revokes_crews
  AFTER UPDATE OF status ON public.subcontractor_companies
  FOR EACH ROW EXECUTE FUNCTION public.revoke_subcontractor_crew_memberships();

CREATE FUNCTION public.revoke_ineligible_crew_memberships()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role OR OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status <> 'active' OR NEW.role <> 'mowing_crew_lead' THEN
      UPDATE public.crews SET leader_id = NULL, updated_at = now()
        WHERE leader_id = NEW.id;
    END IF;
    DELETE FROM public.crew_members cm USING public.crews c
    WHERE cm.crew_id = c.id AND cm.employee_id = NEW.id
      AND (NEW.status <> 'active' OR
        (c.subcontractor_company_id IS NULL AND
          ((cm.role = 'leader' AND NEW.role <> 'mowing_crew_lead') OR
           (cm.role = 'member' AND NEW.role NOT IN
             ('mowing_crew_lead', 'mowing_crew_laborer', 'snow_plow_operator')))) OR
        (c.subcontractor_company_id IS NOT NULL AND NEW.role <> 'subcontractor'));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profile_role_status_revokes_crews
  AFTER UPDATE OF role, status ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.revoke_ineligible_crew_memberships();
REVOKE ALL ON FUNCTION public.manage_subcontractor_company(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manage_subcontractor_company(text, uuid, jsonb) TO authenticated;

-- Replace the existing trigger so a subcontractor can join only its own
-- company's crew; Redline crews continue to accept Redline field roles only.
CREATE OR REPLACE FUNCTION public.validate_current_crew_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE v_status text; v_role public.app_role; v_company uuid;
BEGIN
  SELECT status, role INTO v_status, v_role FROM public.profiles WHERE id = NEW.employee_id;
  SELECT subcontractor_company_id INTO v_company FROM public.crews WHERE id = NEW.crew_id;
  IF NOT FOUND OR v_status <> 'active' OR
    (v_company IS NULL AND (
      (NEW.role = 'leader' AND v_role <> 'mowing_crew_lead') OR
      (NEW.role = 'member' AND v_role NOT IN
        ('mowing_crew_lead', 'mowing_crew_laborer', 'snow_plow_operator'))
    )) OR
    (v_company IS NOT NULL AND (
      NEW.role <> 'member' OR v_role <> 'subcontractor' OR
      NOT EXISTS (SELECT 1 FROM public.subcontractor_memberships m
        JOIN public.subcontractor_companies c ON c.id = m.subcontractor_company_id
        WHERE m.user_id = NEW.employee_id AND m.subcontractor_company_id = v_company
          AND m.active AND c.status = 'active')
    )) THEN
    RAISE EXCEPTION 'Current crew member must be active and match crew company' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.apply_crew_change(p_action text, p_crew_id uuid, p_payload jsonb)
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
  v_company uuid;
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
    IF p_payload ? 'subcontractor_company_id' AND p_payload->>'subcontractor_company_id' IS NOT NULL THEN
      v_company := (p_payload->>'subcontractor_company_id')::uuid;
      PERFORM 1 FROM public.subcontractor_companies WHERE id = v_company AND status = 'active';
      IF NOT FOUND THEN RAISE EXCEPTION 'Active subcontractor company required' USING ERRCODE = '22023'; END IF;
      IF v_leader IS NOT NULL THEN
        RAISE EXCEPTION 'Subcontractor crew cannot use a Redline leader' USING ERRCODE = '22023';
      END IF;
    END IF;
    INSERT INTO public.crews(name, description, leader_id, subcontractor_company_id)
      VALUES (v_name, v_description, v_leader, v_company) RETURNING id INTO v_id;
  ELSE
    SELECT * INTO v_crew FROM public.crews WHERE id = p_crew_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Crew not found' USING ERRCODE = 'P0002'; END IF;
    v_id := v_crew.id;
    v_leader := v_crew.leader_id;
    v_company := v_crew.subcontractor_company_id;
  END IF;

  IF p_action = 'update' THEN
    IF p_payload ? 'subcontractor_company_id' THEN
      RAISE EXCEPTION 'Crew company cannot be changed' USING ERRCODE = '22023';
    END IF;
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
    IF v_company IS NOT NULL AND v_role <> 'member' THEN
      RAISE EXCEPTION 'Company crew members cannot become Redline leaders' USING ERRCODE = '22023';
    END IF;
    SELECT status, role INTO v_status, v_profile_role FROM public.profiles
      WHERE id = v_employee;
    IF NOT FOUND OR v_status <> 'active' OR
       (v_role = 'leader' AND v_profile_role <> 'mowing_crew_lead') OR
       (v_company IS NULL AND v_role = 'member' AND v_profile_role NOT IN
         ('mowing_crew_lead', 'mowing_crew_laborer', 'snow_plow_operator')) OR
       (v_company IS NOT NULL AND (v_profile_role <> 'subcontractor' OR
         NOT EXISTS (SELECT 1 FROM public.subcontractor_memberships m
           WHERE m.subcontractor_company_id = v_company AND m.user_id = v_employee AND m.active))) THEN
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
    (CASE WHEN p_action = 'create' THEN NULL::uuid ELSE v_crew.leader_id END) THEN
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


