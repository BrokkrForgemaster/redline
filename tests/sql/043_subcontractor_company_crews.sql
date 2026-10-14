\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE authenticated;
CREATE TYPE public.app_role AS ENUM ('owner','mowing_crew_lead','mowing_crew_laborer','snow_plow_operator','subcontractor','developer');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.test_user', true), '')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('aal', current_setting('app.test_aal', true)) $$;
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY, role public.app_role NOT NULL, status text NOT NULL);
CREATE FUNCTION public.is_owner_or_admin() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'owner' AND status = 'active') $$;
CREATE TABLE public.subcontractor_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  status text NOT NULL DEFAULT 'active', updated_at timestamptz DEFAULT now());
CREATE TABLE public.subcontractor_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_company_id uuid NOT NULL REFERENCES public.subcontractor_companies(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  role text NOT NULL, active boolean NOT NULL DEFAULT true,
  UNIQUE(subcontractor_company_id, user_id));
CREATE TABLE public.crews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text,
  leader_id uuid REFERENCES public.profiles(id), active boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now());
CREATE TABLE public.crew_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), crew_id uuid NOT NULL REFERENCES public.crews(id),
  employee_id uuid NOT NULL REFERENCES public.profiles(id),
  role text NOT NULL, joined_at timestamptz DEFAULT now(), UNIQUE(crew_id, employee_id));
CREATE TABLE public.audit_logs (
  actor_id uuid, action text, entity_type text, entity_id uuid,
  before_data jsonb, after_data jsonb);
CREATE TABLE public.service_runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), work_order_id uuid NOT NULL);
CREATE TABLE public.work_order_assignments (
  work_order_id uuid NOT NULL, crew_id uuid,
  subcontractor_company_id uuid, assignment_type text NOT NULL, active boolean NOT NULL DEFAULT true);
CREATE TABLE public.service_run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), service_run_id uuid NOT NULL,
  actor_id uuid, event_type text NOT NULL);
CREATE TABLE public.notifications (
  user_id uuid NOT NULL, type text, title text, body text, action_url text,
  entity_type text, entity_id uuid, source_event_id uuid,
  UNIQUE(source_event_id, user_id));
CREATE TABLE public.workflow_delivery_outbox (
  source_event_id uuid NOT NULL, recipient_id uuid NOT NULL, channel text NOT NULL,
  UNIQUE(source_event_id, recipient_id, channel));
ALTER TABLE public.subcontractor_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontractor_memberships ENABLE ROW LEVEL SECURITY;
\ir ../../supabase/migrations/043_subcontractor_company_crews.sql

INSERT INTO public.profiles(id, role, status) VALUES
 ('00000000-0000-4000-8000-000000000001','owner','active'),
 ('00000000-0000-4000-8000-000000000002','subcontractor','active'),
 ('00000000-0000-4000-8000-000000000003','subcontractor','active'),
 ('00000000-0000-4000-8000-000000000004','mowing_crew_laborer','active');
SELECT set_config('app.test_user', '00000000-0000-4000-8000-000000000001', true);
SELECT set_config('app.test_aal', 'aal2', true);
DO $$
DECLARE company_a uuid; company_b uuid; company_crew uuid; redline_crew uuid;
  worker_a uuid; worker_b uuid; work_order uuid; run_id uuid;
BEGIN
  worker_a := '00000000-0000-4000-8000-000000000002';
  worker_b := '00000000-0000-4000-8000-000000000003';
  company_a := public.manage_subcontractor_company('create', NULL, '{"name":"A"}');
  company_b := public.manage_subcontractor_company('create', NULL, '{"name":"B"}');
  PERFORM public.manage_subcontractor_company('add_member', company_a,
    jsonb_build_object('user_id', worker_a, 'membership_role', 'manager'));
  company_crew := public.apply_crew_change('create', NULL,
    jsonb_build_object('name','A crew','subcontractor_company_id',company_a));
  PERFORM public.apply_crew_change('add_member', company_crew,
    jsonb_build_object('employee_id',worker_a,'role','member'));
  IF (SELECT count(*) FROM public.crew_members WHERE crew_id = company_crew) <> 1 THEN
    RAISE EXCEPTION 'Company member was not added';
  END IF;
  BEGIN
    PERFORM public.apply_crew_change('add_member', company_crew,
      '{"employee_id":"00000000-0000-4000-8000-000000000003","role":"member"}');
    RAISE EXCEPTION 'Wrong-company member was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM public.apply_crew_change('add_member', company_crew,
      '{"employee_id":"00000000-0000-4000-8000-000000000004","role":"member"}');
    RAISE EXCEPTION 'Redline worker was accepted into company crew';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  redline_crew := public.apply_crew_change('create', NULL, '{"name":"Redline crew"}');
  BEGIN
    PERFORM public.apply_crew_change('add_member', redline_crew,
      jsonb_build_object('employee_id',worker_a,'role','member'));
    RAISE EXCEPTION 'Subcontractor was accepted into Redline crew';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  PERFORM public.manage_subcontractor_company('add_member', company_a,
    jsonb_build_object('user_id', worker_b, 'membership_role', 'manager'));
  work_order := gen_random_uuid();
  INSERT INTO public.work_order_assignments(work_order_id,crew_id,assignment_type)
    VALUES (work_order,company_crew,'crew');
  INSERT INTO public.service_runs(work_order_id) VALUES (work_order) RETURNING id INTO run_id;
  INSERT INTO public.service_run_events(service_run_id,actor_id,event_type)
    VALUES (run_id,worker_a,'start');
  IF (SELECT count(*) FROM public.notifications WHERE user_id = worker_b) <> 1 OR
     (SELECT count(*) FROM public.workflow_delivery_outbox WHERE recipient_id = worker_b) <> 1 THEN
    RAISE EXCEPTION 'Company supervisor did not receive one event and delivery';
  END IF;
  UPDATE public.subcontractor_memberships SET active = false
    WHERE subcontractor_company_id = company_a AND user_id = worker_a;
  IF EXISTS (SELECT 1 FROM public.crew_members WHERE crew_id = company_crew) THEN
    RAISE EXCEPTION 'Membership revocation retained crew access';
  END IF;
  PERFORM set_config('app.test_user', worker_a::text, true);
  BEGIN
    PERFORM public.manage_subcontractor_company('create', NULL, '{"name":"Forbidden"}');
    RAISE EXCEPTION 'Non-owner created company';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
END $$;
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT ON public.profiles, public.subcontractor_companies,
  public.subcontractor_memberships TO authenticated;
SELECT set_config('app.test_user', '00000000-0000-4000-8000-000000000001', true);
UPDATE public.subcontractor_memberships SET active = false
  WHERE user_id = '00000000-0000-4000-8000-000000000003'
    AND subcontractor_company_id = (SELECT id FROM public.subcontractor_companies WHERE name = 'A');
SELECT public.manage_subcontractor_company('add_member',
  (SELECT id FROM public.subcontractor_companies WHERE name = 'B'),
  '{"user_id":"00000000-0000-4000-8000-000000000003","membership_role":"member"}');
SET LOCAL ROLE authenticated;
SELECT set_config('app.test_user', '00000000-0000-4000-8000-000000000003', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.subcontractor_companies) <> 1 OR
     (SELECT count(*) FROM public.subcontractor_memberships) <> 1 THEN
    RAISE EXCEPTION 'Subcontractor RLS exposed another company or membership';
  END IF;
END $$;
SELECT set_config('app.test_aal', 'aal1', true);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.subcontractor_companies) THEN
    RAISE EXCEPTION 'AAL1 could read company details';
  END IF;
END $$;
RESET ROLE;
ROLLBACK;
