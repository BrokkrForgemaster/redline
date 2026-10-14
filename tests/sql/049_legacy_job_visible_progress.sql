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
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY, crew_id uuid, status public.job_status NOT NULL,
  actual_start timestamptz, updated_at timestamptz);
CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY, employee_id uuid NOT NULL, job_id uuid,
  clock_in timestamptz NOT NULL, clock_out timestamptz, is_manual boolean NOT NULL DEFAULT false);
CREATE TABLE public.job_location_tags (job_id uuid, employee_id uuid, tag_type text);
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
GRANT INSERT ON public.time_entries, public.job_photos TO authenticated;
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
INSERT INTO public.jobs VALUES
  ('00000000-0000-4000-8000-000000000040', '00000000-0000-4000-8000-000000000030', 'scheduled', null, null);
INSERT INTO public.job_location_tags VALUES
  ('00000000-0000-4000-8000-000000000040', '00000000-0000-4000-8000-000000000001', 'manual');

SELECT set_config('app.test_user', '00000000-0000-4000-8000-000000000001', true);
SELECT set_config('app.test_job', '00000000-0000-4000-8000-000000000040', true);
SELECT set_config('app.test_active', 'true', true);
SELECT set_config('app.test_jwt', '{"aal":"aal2"}', true);
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.time_entries VALUES
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
INSERT INTO public.time_entries VALUES
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
    INSERT INTO public.time_entries VALUES
      ('00000000-0000-4000-8000-000000000052', auth.uid(),
       '00000000-0000-4000-8000-000000000040', now(), null, false);
    RAISE EXCEPTION 'First-factor-only clock was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
