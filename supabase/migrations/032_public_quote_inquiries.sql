-- Reuse leads for lightweight website inquiries. No financial estimate is created.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS public_submission_id uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS public_payload_hash text,
  ADD COLUMN IF NOT EXISTS public_rate_bucket text;

CREATE INDEX IF NOT EXISTS leads_public_rate_idx
  ON public.leads(public_rate_bucket, created_at DESC)
  WHERE public_submission_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.inquiry_delivery_outbox (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'sending', 'retry', 'accepted', 'failed', 'disabled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error_class text,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inquiry_delivery_due_idx
  ON public.inquiry_delivery_outbox(state, next_retry_at)
  WHERE state IN ('pending', 'retry');
ALTER TABLE public.inquiry_delivery_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY inquiry_delivery_owner_read ON public.inquiry_delivery_outbox
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'owner' AND p.status = 'active')
    AND coalesce(auth.jwt()->>'aal', '') = 'aal2'
  );

CREATE OR REPLACE FUNCTION public.create_public_quote_inquiry(
  p_submission_id uuid,
  p_payload_hash text,
  p_rate_bucket text,
  p_name text,
  p_email text,
  p_phone text,
  p_service text,
  p_message text
)
RETURNS TABLE(lead_id uuid, delivery_state text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.leads%ROWTYPE;
  v_lead_id uuid;
  v_first_name text;
  v_last_name text;
BEGIN
  IF length(p_payload_hash) <> 64 OR length(p_rate_bucket) <> 64 OR
     p_name IS NULL OR p_email IS NULL OR p_message IS NULL THEN
    RAISE EXCEPTION 'Invalid inquiry' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing FROM public.leads
    WHERE public_submission_id = p_submission_id;
  IF FOUND THEN
    IF v_existing.public_payload_hash <> p_payload_hash THEN
      RAISE EXCEPTION 'Submission key reused with changed content' USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT v_existing.id, d.state
      FROM public.inquiry_delivery_outbox d WHERE d.lead_id = v_existing.id;
    RETURN;
  END IF;

  -- Serialize count checks so concurrent submissions cannot bypass the limits.
  PERFORM pg_advisory_xact_lock(hashtextextended('public_quote_global', 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_rate_bucket, 0));
  SELECT * INTO v_existing FROM public.leads
    WHERE public_submission_id = p_submission_id;
  IF FOUND THEN
    IF v_existing.public_payload_hash <> p_payload_hash THEN
      RAISE EXCEPTION 'Submission key reused with changed content' USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT v_existing.id, d.state
      FROM public.inquiry_delivery_outbox d WHERE d.lead_id = v_existing.id;
    RETURN;
  END IF;
  IF (SELECT count(*) FROM public.leads
      WHERE public_submission_id IS NOT NULL AND created_at > now() - interval '1 hour') >= 100
     OR (SELECT count(*) FROM public.leads
      WHERE public_rate_bucket = p_rate_bucket AND created_at > now() - interval '1 hour') >= 5
     OR (SELECT count(*) FROM public.leads
      WHERE lower(email) = lower(p_email) AND public_submission_id IS NOT NULL
        AND created_at > now() - interval '1 hour') >= 3 THEN
    RAISE EXCEPTION 'Inquiry rate limit exceeded' USING ERRCODE = 'P0001';
  END IF;

  v_first_name := split_part(p_name, ' ', 1);
  v_last_name := nullif(trim(substr(p_name, length(v_first_name) + 1)), '');
  INSERT INTO public.leads(
    source, first_name, last_name, email, phone, requested_services, notes,
    public_submission_id, public_payload_hash, public_rate_bucket
  ) VALUES (
    'website_quote', v_first_name, coalesce(v_last_name, '-'), p_email,
    nullif(p_phone, ''), CASE WHEN p_service = '' THEN '{}'::text[] ELSE ARRAY[p_service] END,
    p_message, p_submission_id, p_payload_hash, p_rate_bucket
  ) RETURNING id INTO v_lead_id;

  INSERT INTO public.inquiry_delivery_outbox(lead_id) VALUES (v_lead_id);
  INSERT INTO public.notifications(user_id, type, title, body, action_url, entity_type, entity_id)
  SELECT id, 'new_lead', 'New website quote inquiry',
    'A new inquiry is ready to review.', '/leads/' || v_lead_id::text, 'lead', v_lead_id
  FROM public.profiles WHERE role = 'owner' AND status = 'active';

  RETURN QUERY SELECT v_lead_id, 'pending'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_quote_inquiry(uuid, text, text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_quote_inquiry(uuid, text, text, text, text, text, text, text)
  TO service_role;
