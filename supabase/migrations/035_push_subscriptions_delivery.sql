CREATE TABLE IF NOT EXISTS public.push_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth_secret text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions(user_id) WHERE enabled = true;
ALTER TABLE public.push_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_endpoint text, p_p256dh text, p_auth_secret text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id = v_actor AND status = 'active') THEN
    RAISE EXCEPTION 'Active account required' USING ERRCODE = '42501';
  END IF;
  IF length(p_endpoint) > 2048 OR length(p_p256dh) NOT BETWEEN 40 AND 256 OR
     length(p_auth_secret) NOT BETWEEN 16 AND 256 THEN
    RAISE EXCEPTION 'Invalid subscription' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.push_subscriptions(user_id, endpoint, p256dh, auth_secret)
    VALUES (v_actor, p_endpoint, p_p256dh, p_auth_secret)
    ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id,
      p256dh = EXCLUDED.p256dh, auth_secret = EXCLUDED.auth_secret,
      enabled = true, updated_at = now()
    RETURNING id INTO v_id;
  INSERT INTO public.push_preferences(user_id, push_enabled)
    VALUES (v_actor, true)
    ON CONFLICT (user_id) DO UPDATE SET push_enabled = true, updated_at = now();
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unregister_push_subscription(p_endpoint text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_changed boolean;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id = v_actor AND status = 'active') THEN
    RAISE EXCEPTION 'Active account required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.push_subscriptions SET enabled = false, updated_at = now()
    WHERE user_id = v_actor AND endpoint = p_endpoint AND enabled = true;
  v_changed := FOUND;
  IF NOT EXISTS (SELECT 1 FROM public.push_subscriptions
      WHERE user_id = v_actor AND enabled = true) THEN
    INSERT INTO public.push_preferences(user_id, push_enabled)
      VALUES (v_actor, false)
      ON CONFLICT (user_id) DO UPDATE SET push_enabled = false, updated_at = now();
  END IF;
  RETURN v_changed;
END;
$$;

ALTER TABLE public.workflow_delivery_outbox
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;
CREATE TABLE IF NOT EXISTS public.workflow_push_attempts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  outbox_id uuid NOT NULL REFERENCES public.workflow_delivery_outbox(id) ON DELETE RESTRICT,
  subscription_id uuid NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE RESTRICT,
  state text NOT NULL CHECK (state IN ('accepted', 'expired', 'retry')),
  last_error_class text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(outbox_id, subscription_id)
);
ALTER TABLE public.workflow_push_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_workflow_push_jobs(p_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, recipient_id uuid, source_event_id uuid, lease_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.role() <> 'service_role' OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Worker access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH candidates AS (
    SELECT job.id FROM public.workflow_delivery_outbox job
    WHERE job.channel = 'push' AND job.next_retry_at <= now()
      AND (job.state IN ('pending', 'retry') OR
        (job.state = 'sending' AND job.locked_until < now()))
    ORDER BY job.next_retry_at, job.id
    LIMIT p_limit FOR UPDATE SKIP LOCKED
  )
  UPDATE public.workflow_delivery_outbox job
  SET state = 'sending', lease_token = uuid_generate_v4(),
    locked_until = now() + interval '2 minutes', updated_at = now()
  FROM candidates WHERE job.id = candidates.id
  RETURNING job.id, job.recipient_id, job.source_event_id, job.lease_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_workflow_push_job(
  p_id uuid, p_lease_token uuid, p_state text, p_error_class text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_attempts integer;
BEGIN
  IF auth.role() <> 'service_role' OR p_state NOT IN ('delivered', 'retry', 'disabled', 'failed') THEN
    RAISE EXCEPTION 'Worker access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.workflow_delivery_outbox job
  SET state = p_state, attempts = job.attempts + 1,
    next_retry_at = CASE WHEN p_state = 'retry'
      THEN now() + make_interval(secs => LEAST(3600, 30 * power(2, LEAST(job.attempts, 7))::integer))
      ELSE job.next_retry_at END,
    accepted_at = CASE WHEN p_state = 'delivered' THEN now() ELSE job.accepted_at END,
    last_error_class = left(p_error_class, 100),
    lease_token = NULL, locked_until = NULL, updated_at = now()
  WHERE job.id = p_id AND job.lease_token = p_lease_token AND job.state = 'sending'
  RETURNING job.attempts INTO v_attempts;
  RETURN v_attempts IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_workflow_push_jobs(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_workflow_push_job(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_workflow_push_jobs(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_workflow_push_job(uuid, uuid, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.register_push_subscription(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unregister_push_subscription(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_subscription(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_push_subscription(text) TO authenticated;
