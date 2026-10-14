-- One open personal or legacy job time entry per employee.
-- Refuse to hide pre-existing conflicts; reconcile them before applying this migration.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.time_entries WHERE clock_out IS NULL GROUP BY employee_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Open time entries overlap for an employee; reconcile before migration 044';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS time_entries_one_open_per_employee
ON public.time_entries(employee_id) WHERE clock_out IS NULL;

-- Migration 024 narrowed is_staff() to Admin, so field staff need a scoped
-- personal clock policy. The restrictive MFA/current-account policy from 039
-- remains in force for every command.
CREATE POLICY "Active staff can clock in personally"
ON public.time_entries FOR INSERT TO authenticated
WITH CHECK (
  employee_id = auth.uid() AND job_id IS NULL AND clock_out IS NULL
  AND public.has_current_business_account()
  AND COALESCE(auth.jwt()->>'aal', '') = 'aal2'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()
    AND status = 'active' AND role IN ('owner', 'mowing_crew_lead',
      'mowing_crew_laborer', 'snow_plow_operator', 'subcontractor'))
);
