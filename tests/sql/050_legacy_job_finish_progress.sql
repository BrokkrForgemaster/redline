\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE ROLE authenticated;
CREATE TYPE public.job_status AS ENUM (
  'approved', 'ready_to_schedule', 'scheduled', 'en_route', 'arrived',
  'in_progress', 'paused', 'completed', 'cancelled', 'archived');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.test_user', true), '')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('app.test_jwt', true), '')::jsonb, '{}'::jsonb) $$;
CREATE TABLE public.profiles (id uuid PRIMARY KEY, role text NOT NULL, status text NOT NULL);
CREATE TABLE public.subcontractor_companies (id uuid PRIMARY KEY, status text NOT NULL);
CREATE TABLE public.subcontractor_memberships (
  user_id uuid NOT NULL, subcontractor_company_id uuid NOT NULL,
  active boolean NOT NULL, role text NOT NULL);
CREATE TABLE public.crews (
  id uuid PRIMARY KEY, active boolean NOT NULL, leader_id uuid,
  subcontractor_company_id uuid);
CREATE TABLE public.crew_members (crew_id uuid, employee_id uuid);
CREATE TABLE public.job_assignments (job_id uuid, employee_id uuid);
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY, crew_id uuid, status public.job_status NOT NULL,
  actual_start timestamptz, actual_end timestamptz,
  is_recurring boolean NOT NULL DEFAULT false, updated_at timestamptz);
CREATE TABLE public.work_orders (legacy_job_id uuid);
CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY, employee_id uuid NOT NULL, job_id uuid,
  clock_in timestamptz NOT NULL, clock_out timestamptz,
  is_manual boolean NOT NULL DEFAULT false, updated_at timestamptz DEFAULT now());
CREATE TABLE public.job_location_tags (
  id uuid DEFAULT gen_random_uuid(), job_id uuid, employee_id uuid, tag_type text,
  latitude numeric, longitude numeric, accuracy_meters numeric,
  captured_at_device timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE storage.objects (bucket_id text, name text);
CREATE TABLE public.job_photos (
  id uuid PRIMARY KEY, job_id uuid NOT NULL, employee_id uuid,
  storage_path text NOT NULL, photo_type text NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE public.job_status_history (
  job_id uuid, from_status public.job_status, to_status public.job_status,
  changed_by uuid, notes text, created_at timestamptz DEFAULT now());
CREATE TABLE public.notifications (
  user_id uuid, type text, title text, body text, action_url text,
  entity_type text, entity_id uuid);
CREATE FUNCTION public.can_access_legacy_job(p_job_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT p_job_id =
  nullif(current_setting('app.test_job', true), '')::uuid AND
  current_setting('app.test_active', true) = 'true' $$;
GRANT USAGE ON SCHEMA auth, public TO authenticated;
GRANT INSERT, UPDATE, SELECT ON public.time_entries TO authenticated;
GRANT INSERT ON public.job_photos TO authenticated;
\ir ../../supabase/migrations/049_legacy_job_visible_progress.sql

INSERT INTO public.profiles VALUES
  ('00000000-0000-4000-8000-000000000001', 'mowing_crew_laborer', 'active'),
  ('00000000-0000-4000-8000-000000000002', 'owner', 'active'),
  ('00000000-0000-4000-8000-000000000003', 'subcontractor', 'active'),
  ('00000000-0000-4000-8000-000000000004', 'subcontractor', 'active'),
  ('00000000-0000-4000-8000-000000000005', 'mowing_crew_lead', 'active');
INSERT INTO public.subcontractor_companies VALUES
  ('00000000-0000-4000-8000-000000000020', 'active'),
  ('00000000-0000-4000-8000-000000000021', 'active');
INSERT INTO public.subcontractor_memberships VALUES
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000020', true, 'manager'),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000021', true, 'manager');
INSERT INTO public.crews VALUES
  ('00000000-0000-4000-8000-000000000030', true,
   '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000020');
INSERT INTO public.jobs(id,crew_id,status) VALUES
  ('00000000-0000-4000-8000-000000000040', '00000000-0000-4000-8000-000000000030', 'scheduled');
INSERT INTO public.crew_members VALUES
  ('00000000-0000-4000-8000-000000000030','00000000-0000-4000-8000-000000000001');
INSERT INTO public.job_location_tags(job_id,employee_id,tag_type) VALUES
  ('00000000-0000-4000-8000-000000000040', '00000000-0000-4000-8000-000000000001', 'manual');

SELECT set_config('app.test_user', '00000000-0000-4000-8000-000000000001', true);
SELECT set_config('app.test_job', '00000000-0000-4000-8000-000000000040', true);
SELECT set_config('app.test_active', 'true', true);
SELECT set_config('app.test_jwt', '{"aal":"aal2"}', true);
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.time_entries(id,employee_id,job_id,clock_in,clock_out,is_manual) VALUES
      ('00000000-0000-4000-8000-000000000050', auth.uid(),
       '00000000-0000-4000-8000-000000000040', now(), null, false);
    RAISE EXCEPTION 'Start without photos was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.job_photos VALUES
      ('00000000-0000-4000-8000-000000000060',
       '00000000-0000-4000-8000-000000000040', auth.uid(), 'missing', 'before');
    RAISE EXCEPTION 'Photo without stored object was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
RESET ROLE;

INSERT INTO storage.objects VALUES
  ('job-photos','one'), ('job-photos','two'), ('job-photos','three');
SET ROLE authenticated;
INSERT INTO public.job_photos(id,job_id,employee_id,storage_path,photo_type) VALUES
  ('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000040',auth.uid(),'one','before'),
  ('00000000-0000-4000-8000-000000000062','00000000-0000-4000-8000-000000000040',auth.uid(),'two','before'),
  ('00000000-0000-4000-8000-000000000063','00000000-0000-4000-8000-000000000040',auth.uid(),'three','before');
INSERT INTO public.time_entries(id,employee_id,job_id,clock_in,clock_out,is_manual) VALUES
  ('00000000-0000-4000-8000-000000000051', auth.uid(),
   '00000000-0000-4000-8000-000000000040', now(), null, false);
RESET ROLE;
DO $$ BEGIN
  IF (SELECT status FROM public.jobs WHERE id='00000000-0000-4000-8000-000000000040') <> 'in_progress'
    OR (SELECT count(*) FROM public.job_status_history WHERE to_status='in_progress') <> 1
    OR (SELECT count(*) FROM public.notifications WHERE type='legacy_job_start') <> 3
    OR (SELECT count(*) FROM public.notifications WHERE type='legacy_before_photos_ready') <> 3
    OR EXISTS (SELECT 1 FROM public.notifications WHERE user_id='00000000-0000-4000-8000-000000000004') THEN
    RAISE EXCEPTION 'Start, photo threshold, or recipient scope failed';
  END IF;
END $$;
SELECT set_config('app.test_jwt', '{"aal":"aal1"}', true);
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.time_entries(id,employee_id,job_id,clock_in,clock_out,is_manual) VALUES
      ('00000000-0000-4000-8000-000000000052', auth.uid(),
       '00000000-0000-4000-8000-000000000040', now(), null, false);
    RAISE EXCEPTION 'First-factor-only clock was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('app.test_jwt', '{"aal":"aal2"}', true);
\ir ../../supabase/migrations/050_legacy_job_finish_progress.sql
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.finish_legacy_job_clock(
      '00000000-0000-4000-8000-000000000051',
      '00000000-0000-4000-8000-000000000040',
      38.0, -85.0, 10.0, now());
    RAISE EXCEPTION 'Finish without stored after photos was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
RESET ROLE;
INSERT INTO storage.objects VALUES
  ('job-photos','after-one'), ('job-photos','after-two'), ('job-photos','after-three');
SET ROLE authenticated;
INSERT INTO public.job_photos(id,job_id,employee_id,storage_path,photo_type) VALUES
  ('00000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000040',auth.uid(),'after-one','after'),
  ('00000000-0000-4000-8000-000000000072','00000000-0000-4000-8000-000000000040',auth.uid(),'after-two','after'),
  ('00000000-0000-4000-8000-000000000073','00000000-0000-4000-8000-000000000040',auth.uid(),'after-three','after');
SELECT set_config('app.test_jwt', '{"aal":"aal1"}', true);
DO $$ BEGIN
  BEGIN
    PERFORM public.finish_legacy_job_clock(
      '00000000-0000-4000-8000-000000000051',
      '00000000-0000-4000-8000-000000000040', 38.0, -85.0, 10.0, now());
    RAISE EXCEPTION 'First-factor-only finish was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('app.test_jwt', '{"aal":"aal2"}', true);
SELECT set_config('app.test_user', '00000000-0000-4000-8000-000000000004', true);
DO $$ BEGIN
  BEGIN
    PERFORM public.finish_legacy_job_clock(
      '00000000-0000-4000-8000-000000000051',
      '00000000-0000-4000-8000-000000000040', 38.0, -85.0, 10.0, now());
    RAISE EXCEPTION 'Other-company finish was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('app.test_user', '00000000-0000-4000-8000-000000000001', true);
SELECT public.finish_legacy_job_clock(
  '00000000-0000-4000-8000-000000000051',
  '00000000-0000-4000-8000-000000000040',
  38.0, -85.0, 10.0, now());
SELECT public.finish_legacy_job_clock(
  '00000000-0000-4000-8000-000000000051',
  '00000000-0000-4000-8000-000000000040',
  38.0, -85.0, 10.0, now());
RESET ROLE;
DO $$ BEGIN
  IF (SELECT status FROM public.jobs WHERE id='00000000-0000-4000-8000-000000000040') <> 'completed'
    OR (SELECT count(*) FROM public.job_status_history WHERE to_status='completed') <> 1
    OR (SELECT count(*) FROM public.notifications WHERE type='legacy_job_finish') <> 3
    OR (SELECT count(*) FROM public.job_location_tags WHERE tag_type='finish') <> 1
    OR (SELECT count(*) FROM public.time_entries WHERE id='00000000-0000-4000-8000-000000000051'
      AND clock_out IS NOT NULL) <> 1 THEN
    RAISE EXCEPTION 'Verified finish, idempotent retry or scoped alert failed';
  END IF;
END $$;
INSERT INTO public.jobs(id,crew_id,status,is_recurring) VALUES
  ('00000000-0000-4000-8000-000000000041',
   '00000000-0000-4000-8000-000000000030','in_progress',true);
INSERT INTO public.time_entries(id,employee_id,job_id,clock_in,is_manual) VALUES
  ('00000000-0000-4000-8000-000000000053',
   '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000041', now() - interval '5 minutes', true);
INSERT INTO public.time_entries(id,employee_id,clock_in,is_manual) VALUES
  ('00000000-0000-4000-8000-000000000054',
   '00000000-0000-4000-8000-000000000001', now() - interval '5 minutes', true);
INSERT INTO storage.objects VALUES
  ('job-photos','recurring-one'),('job-photos','recurring-two'),('job-photos','recurring-three');
SET ROLE authenticated;
INSERT INTO public.job_photos(id,job_id,employee_id,storage_path,photo_type) VALUES
  ('00000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000041',auth.uid(),'recurring-one','after'),
  ('00000000-0000-4000-8000-000000000082','00000000-0000-4000-8000-000000000041',auth.uid(),'recurring-two','after'),
  ('00000000-0000-4000-8000-000000000083','00000000-0000-4000-8000-000000000041',auth.uid(),'recurring-three','after');
SELECT public.finish_legacy_job_clock(
  '00000000-0000-4000-8000-000000000053',
  '00000000-0000-4000-8000-000000000041', 38.0, -85.0, 10.0, now());
RESET ROLE;
DO $$ BEGIN
  IF (SELECT status FROM public.jobs WHERE id='00000000-0000-4000-8000-000000000041') <> 'in_progress'
    OR (SELECT count(*) FROM public.notifications WHERE type='legacy_job_visit_finished') <> 3
    OR (SELECT count(*) FROM public.time_entries WHERE id='00000000-0000-4000-8000-000000000054'
      AND clock_out IS NULL) <> 1 THEN
    RAISE EXCEPTION 'Recurring work or independent personal clock was changed';
  END IF;
END $$;
ROLLBACK;
