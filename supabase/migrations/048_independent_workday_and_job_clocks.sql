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

-- The existing employee UPDATE policy permits closing an open entry. Do not
-- let a browser turn a personal entry into a job entry (or switch job/actor).
CREATE FUNCTION public.guard_time_entry_clock_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (
    NEW.employee_id IS DISTINCT FROM OLD.employee_id OR
    NEW.job_id IS DISTINCT FROM OLD.job_id OR
    NEW.clock_in IS DISTINCT FROM OLD.clock_in OR
    NEW.snow_event_id IS DISTINCT FROM OLD.snow_event_id OR
    NEW.route_id IS DISTINCT FROM OLD.route_id
  ) THEN
    RAISE EXCEPTION 'Time entry identity cannot be changed by the signed-in worker';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_time_entry_clock_identity() FROM PUBLIC;

CREATE TRIGGER time_entry_clock_identity_guard
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.guard_time_entry_clock_identity();
