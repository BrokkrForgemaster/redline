-- A personal shift and one assigned job clock may run at the same time.
-- Install both guards before dropping the broader constraint from 044.
CREATE UNIQUE INDEX IF NOT EXISTS time_entries_one_open_workday_per_employee
  ON public.time_entries(employee_id)
  WHERE clock_out IS NULL AND job_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS time_entries_one_open_job_per_employee
  ON public.time_entries(employee_id)
  WHERE clock_out IS NULL AND job_id IS NOT NULL;

DROP INDEX IF EXISTS public.time_entries_one_open_per_employee;

-- Migration 024 narrowed is_staff() to Admin. The legacy field screen still
-- needs a narrow job-clock INSERT policy for currently assigned field staff.
CREATE POLICY "Active assigned staff can clock in to a job"
  ON public.time_entries FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
    AND job_id IS NOT NULL
    AND clock_out IS NULL
    AND snow_event_id IS NULL
    AND route_id IS NULL
    AND is_manual = false
    AND public.has_current_business_account()
    AND COALESCE(auth.jwt()->>'aal', '') = 'aal2'
    AND public.can_access_legacy_job(job_id)
  );
