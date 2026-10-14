-- A subcontractor company supervisor can see work assigned to any active
-- crew owned by that same active company. Ordinary crew workers retain their
-- own crew scope. This helper is also used by legacy job RLS and search.
CREATE FUNCTION public.is_current_company_supervisor_for_crew(p_crew_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crews crew
    JOIN public.subcontractor_companies company
      ON company.id = crew.subcontractor_company_id AND company.status = 'active'
    JOIN public.subcontractor_memberships membership
      ON membership.subcontractor_company_id = company.id
      AND membership.user_id = auth.uid() AND membership.active
      AND membership.role IN ('owner', 'manager')
    JOIN public.profiles profile ON profile.id = membership.user_id
      AND profile.role = 'subcontractor' AND profile.status = 'active'
    WHERE crew.id = p_crew_id AND crew.active
  )
$$;
REVOKE ALL ON FUNCTION public.is_current_company_supervisor_for_crew(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_current_company_supervisor_for_crew(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_company_supervisor_for_crew(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_legacy_job(p_job_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles profile
    JOIN public.jobs job ON job.id = p_job_id
    WHERE profile.id = auth.uid() AND profile.status = 'active'
      AND (
        profile.role = 'owner'
        OR (profile.role IN ('mowing_crew_lead', 'mowing_crew_laborer',
                             'snow_plow_operator', 'subcontractor')
          AND (
            EXISTS (SELECT 1 FROM public.job_assignments assignment
              WHERE assignment.job_id = job.id AND assignment.employee_id = profile.id)
            OR EXISTS (SELECT 1 FROM public.crews crew
              JOIN public.crew_members member ON member.crew_id = crew.id
              WHERE crew.id = job.crew_id AND crew.active AND member.employee_id = profile.id)
            OR public.is_current_company_supervisor_for_crew(job.crew_id)
          ))
      )
  )
$$;

-- Preserve the 046 staff privacy rule while including current company-crew
-- supervisors in the assignment predicate before matching or counting.
CREATE OR REPLACE FUNCTION public.search_assigned_work_orders(
  p_query text, p_status text DEFAULT NULL, p_sort text DEFAULT 'scheduled_asc',
  p_page_size integer DEFAULT 25, p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid, work_order_number text, title text, status text,
  scheduled_start timestamptz, customer_name text, property_address text,
  total_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role public.app_role;
  v_query text := lower(trim(coalesce(p_query, '')));
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT p.role INTO v_role FROM public.profiles p
    WHERE p.id = v_actor AND p.status = 'active';
  IF v_role IS NULL OR v_role NOT IN
      ('owner', 'mowing_crew_lead', 'mowing_crew_laborer', 'snow_plow_operator', 'subcontractor') THEN
    RAISE EXCEPTION 'Operational access required' USING ERRCODE = '42501';
  END IF;
  IF length(v_query) > 100 OR p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 OR
     p_offset IS NULL OR p_offset < 0 OR p_offset > 10000 OR
     p_sort IS NULL OR p_sort NOT IN ('scheduled_asc', 'scheduled_desc', 'updated_desc') OR
     (p_status IS NOT NULL AND p_status NOT IN
       ('open', 'active', 'draft', 'scheduled', 'assigned', 'ready', 'in_progress',
        'paused', 'submitted', 'needs_review', 'completed', 'rejected', 'cancelled')) THEN
    RAISE EXCEPTION 'Invalid search filters' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT wo.id, wo.work_order_number, wo.title, wo.status::text,
    wo.scheduled_start,
    CASE WHEN v_role = 'owner' THEN
      coalesce(nullif(c.business_name, ''), concat_ws(' ', c.first_name, c.last_name))
    ELSE coalesce(nullif(c.business_name, ''), 'Job site') END,
    concat_ws(', ', property.address_line1, property.city, property.state),
    count(*) OVER ()
  FROM public.work_orders wo
  JOIN public.customers c ON c.id = wo.customer_id
  JOIN public.properties property ON property.id = wo.property_id
  WHERE (v_role = 'owner' OR EXISTS (
    SELECT 1 FROM public.work_order_assignments assignment
    WHERE assignment.work_order_id = wo.id AND assignment.active = true
      AND ((assignment.assignment_type = 'employee' AND assignment.employee_id = v_actor)
        OR (assignment.assignment_type = 'crew' AND EXISTS (
          SELECT 1 FROM public.crew_members member
          JOIN public.crews crew ON crew.id = member.crew_id AND crew.active = true
          WHERE member.crew_id = assignment.crew_id AND member.employee_id = v_actor
        ))
        OR (assignment.assignment_type = 'crew' AND
          public.is_current_company_supervisor_for_crew(assignment.crew_id))
        OR (assignment.assignment_type = 'subcontractor' AND EXISTS (
          SELECT 1 FROM public.subcontractor_memberships membership
          JOIN public.subcontractor_companies company
            ON company.id = membership.subcontractor_company_id AND company.status = 'active'
          WHERE membership.subcontractor_company_id = assignment.subcontractor_company_id
            AND membership.user_id = v_actor AND membership.active = true
        )))
  ))
    AND (p_status IS NULL OR
      (p_status = 'open' AND wo.status::text IN
        ('draft', 'scheduled', 'assigned', 'ready', 'in_progress', 'paused', 'submitted', 'needs_review')) OR
      (p_status = 'active' AND wo.status::text IN ('in_progress', 'paused')) OR
      wo.status::text = p_status)
    AND (v_query = '' OR position(v_query IN lower(concat_ws(' ',
      wo.work_order_number, wo.title, wo.description, c.business_name,
      property.address_line1, property.city, property.state,
      CASE WHEN v_role = 'owner' THEN c.first_name END,
      CASE WHEN v_role = 'owner' THEN c.last_name END))) > 0)
  ORDER BY
    CASE WHEN p_sort = 'scheduled_asc' THEN wo.scheduled_start END ASC NULLS LAST,
    CASE WHEN p_sort = 'scheduled_desc' THEN wo.scheduled_start END DESC NULLS LAST,
    CASE WHEN p_sort = 'updated_desc' THEN wo.updated_at END DESC NULLS LAST,
    wo.id ASC
  LIMIT p_page_size OFFSET p_offset;
END $$;
