\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA auth;
CREATE ROLE authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.test_user', true), '')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(nullif(current_setting('app.test_jwt', true), '')::jsonb, '{}'::jsonb) $$;
CREATE FUNCTION public.has_current_business_account() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.test_active', true) = 'true' $$;
CREATE FUNCTION public.can_access_legacy_job(p_job_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT p_job_id = nullif(current_setting('app.test_job', true), '')::uuid $$;
CREATE TABLE public.time_entries (
  employee_id uuid NOT NULL, job_id uuid, clock_out timestamptz,
  snow_event_id uuid, route_id uuid, is_manual boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX time_entries_one_open_per_employee
  ON public.time_entries(employee_id) WHERE clock_out IS NULL;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.time_entries TO authenticated;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE POLICY "Active staff can clock in personally" ON public.time_entries
  FOR INSERT TO authenticated WITH CHECK (
    employee_id = auth.uid() AND job_id IS NULL AND clock_out IS NULL
    AND public.has_current_business_account() AND auth.jwt()->>'aal' = 'aal2');
\ir ../../supabase/migrations/048_independent_workday_and_job_clocks.sql

SELECT set_config('app.test_user', '00000000-0000-4000-8000-000000000001', true);
SELECT set_config('app.test_job', '00000000-0000-4000-8000-000000000002', true);
SELECT set_config('app.test_active', 'true', true);
SELECT set_config('app.test_jwt', '{"aal":"aal2"}', true);
SET ROLE authenticated;
INSERT INTO public.time_entries(employee_id) VALUES
  ('00000000-0000-4000-8000-000000000001');
INSERT INTO public.time_entries(employee_id, job_id) VALUES
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.time_entries(employee_id) VALUES ('00000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Second personal clock was accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.time_entries(employee_id, job_id) VALUES
      ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'Second job clock was accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.time_entries(employee_id, job_id) VALUES
      ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003');
    RAISE EXCEPTION 'Unassigned job was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('app.test_jwt', '{"aal":"aal1"}', true);
DO $$ BEGIN
  BEGIN
    INSERT INTO public.time_entries(employee_id, job_id) VALUES
      ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'First-factor-only job clock was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
