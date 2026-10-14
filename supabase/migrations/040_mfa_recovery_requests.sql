-- Website request and audited owner-assisted factor recovery.
-- The owner must verify identity outside the browser before approval.
CREATE TABLE IF NOT EXISTS public.mfa_recovery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 500),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'provider_pending', 'completed', 'denied')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  identity_method text CHECK (identity_method IN ('in_person', 'known_callback')),
  review_note text,
  identity_verified_at timestamptz,
  completed_at timestamptz,
  provider_error text
);

CREATE UNIQUE INDEX IF NOT EXISTS mfa_recovery_one_open_per_user
ON public.mfa_recovery_requests(user_id)
WHERE status IN ('pending', 'provider_pending');

CREATE INDEX IF NOT EXISTS mfa_recovery_pending_requested
ON public.mfa_recovery_requests(status, requested_at)
WHERE status IN ('pending', 'provider_pending');

ALTER TABLE public.mfa_recovery_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requester can view own MFA recovery"
ON public.mfa_recovery_requests FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Active owner can view MFA recovery"
ON public.mfa_recovery_requests FOR SELECT TO authenticated
USING (public.is_owner_or_admin() AND COALESCE(auth.jwt()->>'aal', '') = 'aal2');

CREATE OR REPLACE FUNCTION public.request_mfa_recovery(p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE request_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid()
      AND status IN ('active', 'invited')
  ) THEN
    RAISE EXCEPTION 'Account unavailable' USING ERRCODE = '42501';
  END IF;
  p_reason := btrim(p_reason);
  IF p_reason IS NULL OR char_length(p_reason) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'Reason must be 10 to 500 characters' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('redline:mfa-recovery:' || auth.uid()::text));
  SELECT id INTO request_id FROM public.mfa_recovery_requests
    WHERE user_id = auth.uid() AND status IN ('pending', 'provider_pending')
    ORDER BY requested_at DESC LIMIT 1;
  IF request_id IS NOT NULL THEN RETURN request_id; END IF;
  IF (SELECT count(*) FROM public.mfa_recovery_requests
      WHERE user_id = auth.uid() AND requested_at > now() - interval '24 hours') >= 3 THEN
    RAISE EXCEPTION 'Recovery request limit reached' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.mfa_recovery_requests(user_id, reason)
  VALUES (auth.uid(), p_reason) RETURNING id INTO request_id;
  RETURN request_id;
END $$;

CREATE OR REPLACE FUNCTION public.begin_mfa_recovery(
  p_request_id uuid, p_identity_method text, p_review_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  recovery public.mfa_recovery_requests%ROWTYPE;
  recent_totp boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(auth.jwt()->'amr', '[]'::jsonb)) AS m(value)
    WHERE m.value->>'method' = 'totp'
      AND m.value->>'timestamp' ~ '^[0-9]+$'
      AND to_timestamp((m.value->>'timestamp')::bigint) >= now() - interval '15 minutes'
      AND to_timestamp((m.value->>'timestamp')::bigint) <= now() + interval '1 minute'
  ) INTO recent_totp;
  IF NOT public.is_owner_or_admin()
     OR COALESCE(auth.jwt()->>'aal', '') <> 'aal2'
     OR NOT recent_totp THEN
    RAISE EXCEPTION 'Recent owner MFA required' USING ERRCODE = '42501';
  END IF;
  IF p_identity_method NOT IN ('in_person', 'known_callback')
     OR p_review_note IS NULL OR char_length(btrim(p_review_note)) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'Identity verification details required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO recovery FROM public.mfa_recovery_requests
  WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR recovery.status NOT IN ('pending', 'provider_pending')
     OR recovery.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Recovery request unavailable' USING ERRCODE = '42501';
  END IF;
  IF recovery.status = 'provider_pending' THEN
    IF recovery.reviewed_by <> auth.uid() THEN
      RAISE EXCEPTION 'Recovery is being handled by another owner' USING ERRCODE = '42501';
    END IF;
    RETURN recovery.user_id;
  END IF;
  UPDATE public.mfa_recovery_requests SET
    status = 'provider_pending', reviewed_by = auth.uid(),
    identity_method = p_identity_method, review_note = btrim(p_review_note),
    identity_verified_at = now(), provider_error = NULL
  WHERE id = p_request_id;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data)
  VALUES (auth.uid(), 'mfa_recovery_identity_verified', 'mfa_recovery_request', p_request_id,
    jsonb_build_object('status', recovery.status),
    jsonb_build_object('status', 'provider_pending', 'identity_method', p_identity_method));
  RETURN recovery.user_id;
END $$;

CREATE OR REPLACE FUNCTION public.complete_mfa_recovery(p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE recovery public.mfa_recovery_requests%ROWTYPE;
BEGIN
  SELECT * INTO recovery FROM public.mfa_recovery_requests
    WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR recovery.status <> 'provider_pending'
     OR recovery.reviewed_by IS NULL OR recovery.identity_verified_at IS NULL THEN
    RAISE EXCEPTION 'Recovery is not ready to complete' USING ERRCODE = '42501';
  END IF;
  UPDATE public.mfa_recovery_requests
    SET status = 'completed', completed_at = now(), provider_error = NULL
    WHERE id = p_request_id;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data)
  VALUES (recovery.reviewed_by, 'mfa_recovery_factors_removed', 'mfa_recovery_request', p_request_id,
    jsonb_build_object('status', recovery.status), jsonb_build_object('status', 'completed'));
END $$;

REVOKE ALL ON FUNCTION public.request_mfa_recovery(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.begin_mfa_recovery(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_mfa_recovery(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_mfa_recovery(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.begin_mfa_recovery(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_mfa_recovery(uuid) TO service_role;
