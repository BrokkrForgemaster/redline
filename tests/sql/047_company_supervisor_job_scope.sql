\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA auth;
CREATE ROLE authenticated;
CREATE ROLE anon;
CREATE TYPE public.app_role AS ENUM
  ('owner','developer','mowing_crew_lead','mowing_crew_laborer','snow_plow_operator','subcontractor');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.test_user', true), '')::uuid $$;
CREATE TABLE public.profiles (id uuid PRIMARY KEY, role public.app_role NOT NULL, status text NOT NULL);
CREATE TABLE public.subcontractor_companies (id uuid PRIMARY KEY, status text NOT NULL);
CREATE TABLE public.subcontractor_memberships (
  user_id uuid NOT NULL, subcontractor_company_id uuid NOT NULL,
  active boolean NOT NULL, role text NOT NULL);
CREATE TABLE public.crews (
  id uuid PRIMARY KEY, active boolean NOT NULL, subcontractor_company_id uuid);
CREATE TABLE public.crew_members (crew_id uuid NOT NULL, employee_id uuid NOT NULL);
CREATE TABLE public.customers (
  id uuid PRIMARY KEY, business_name text, first_name text, last_name text);
CREATE TABLE public.properties (
  id uuid PRIMARY KEY, address_line1 text, city text, state text);
CREATE TABLE public.jobs (id uuid PRIMARY KEY, customer_id uuid, crew_id uuid);
CREATE TABLE public.job_assignments (job_id uuid, employee_id uuid);
CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY, work_order_number text, title text, description text,
  status text, scheduled_start timestamptz, updated_at timestamptz,
  customer_id uuid, property_id uuid);
CREATE TABLE public.work_order_assignments (
  work_order_id uuid, assignment_type text, employee_id uuid,
  crew_id uuid, subcontractor_company_id uuid, active boolean);
\ir ../../supabase/migrations/047_company_supervisor_job_scope.sql

INSERT INTO public.profiles VALUES
  ('00000000-0000-4000-8000-000000000001','owner','active'),
  ('00000000-0000-4000-8000-000000000002','subcontractor','active'),
  ('00000000-0000-4000-8000-000000000003','subcontractor','active'),
  ('00000000-0000-4000-8000-000000000004','subcontractor','active'),
  ('00000000-0000-4000-8000-000000000005','developer','active');
INSERT INTO public.subcontractor_companies VALUES
  ('10000000-0000-4000-8000-000000000001','active'),
  ('10000000-0000-4000-8000-000000000002','active');
INSERT INTO public.subcontractor_memberships VALUES
  ('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',true,'manager'),
  ('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002',true,'manager'),
  ('00000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001',true,'worker');
INSERT INTO public.crews VALUES
  ('20000000-0000-4000-8000-000000000001',true,'10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002',true,'10000000-0000-4000-8000-000000000002');
INSERT INTO public.customers VALUES
  ('30000000-0000-4000-8000-000000000001','Business A','PrivateA','Customer'),
  ('30000000-0000-4000-8000-000000000002','Business B','PrivateB','Customer');
INSERT INTO public.properties VALUES
  ('40000000-0000-4000-8000-000000000001','A Street','Lexington','KY'),
  ('40000000-0000-4000-8000-000000000002','B Street','Lexington','KY');
INSERT INTO public.jobs VALUES
  ('50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002');
INSERT INTO public.work_orders VALUES
  ('60000000-0000-4000-8000-000000000001','WO-A','Mow A','description','assigned',now(),now(),
    '30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000002','WO-B','Mow B','description','assigned',now(),now(),
    '30000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002');
INSERT INTO public.work_order_assignments VALUES
  ('60000000-0000-4000-8000-000000000001','crew',null,'20000000-0000-4000-8000-000000000001',null,true),
  ('60000000-0000-4000-8000-000000000002','crew',null,'20000000-0000-4000-8000-000000000002',null,true);

DO $$
DECLARE a_job uuid := '50000000-0000-4000-8000-000000000001';
        b_job uuid := '50000000-0000-4000-8000-000000000002';
        a_crew uuid := '20000000-0000-4000-8000-000000000001';
BEGIN
  PERFORM set_config('app.test_user','00000000-0000-4000-8000-000000000002',true);
  IF NOT public.can_access_legacy_job(a_job) OR public.can_access_legacy_job(b_job)
    OR NOT public.is_current_company_supervisor_for_crew(a_crew) THEN
    RAISE EXCEPTION 'Company A manager scope failed';
  END IF;
  IF (SELECT count(*) FROM public.search_assigned_work_orders('',null,'scheduled_asc',25,0)) <> 1
    OR (SELECT count(*) FROM public.search_assigned_work_orders('PrivateA',null,'scheduled_asc',25,0)) <> 0
    OR (SELECT customer_name FROM public.search_assigned_work_orders('',null,'scheduled_asc',25,0)) <> 'Business A' THEN
    RAISE EXCEPTION 'Staff search scope or customer privacy failed';
  END IF;
  PERFORM set_config('app.test_user','00000000-0000-4000-8000-000000000003',true);
  IF public.can_access_legacy_job(a_job) OR NOT public.can_access_legacy_job(b_job) THEN
    RAISE EXCEPTION 'Cross-company access failed';
  END IF;
  PERFORM set_config('app.test_user','00000000-0000-4000-8000-000000000004',true);
  IF public.can_access_legacy_job(a_job) THEN
    RAISE EXCEPTION 'Ordinary company worker gained supervisor scope';
  END IF;
  INSERT INTO public.crew_members VALUES (a_crew,'00000000-0000-4000-8000-000000000004');
  IF NOT public.can_access_legacy_job(a_job) THEN
    RAISE EXCEPTION 'Assigned company crew worker was denied';
  END IF;
  PERFORM set_config('app.test_user','00000000-0000-4000-8000-000000000005',true);
  IF public.can_access_legacy_job(a_job) THEN
    RAISE EXCEPTION 'Developer gained business access';
  END IF;
  PERFORM set_config('app.test_user','00000000-0000-4000-8000-000000000002',true);
  UPDATE public.subcontractor_memberships SET active=false
    WHERE user_id='00000000-0000-4000-8000-000000000002';
  IF public.can_access_legacy_job(a_job) THEN
    RAISE EXCEPTION 'Revoked manager retained job access';
  END IF;
END $$;
ROLLBACK;
