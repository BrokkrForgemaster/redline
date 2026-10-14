ALTER TABLE public.inquiry_delivery_outbox
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;

CREATE OR REPLACE FUNCTION public.claim_inquiry_delivery_jobs(p_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, lead_id uuid, lease_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.role() <> 'service_role' OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Worker access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH candidates AS (
    SELECT job.id FROM public.inquiry_delivery_outbox job
    WHERE job.next_retry_at <= now()
      AND (job.state IN ('pending', 'retry') OR
        (job.state = 'sending' AND job.locked_until < now()))
    ORDER BY job.next_retry_at, job.id
    LIMIT p_limit FOR UPDATE SKIP LOCKED
  )
  UPDATE public.inquiry_delivery_outbox job
  SET state = 'sending', lease_token = uuid_generate_v4(),
    locked_until = now() + interval '2 minutes', updated_at = now()
  FROM candidates WHERE job.id = candidates.id
  RETURNING job.id, job.lead_id, job.lease_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_inquiry_delivery_job(
  p_id uuid, p_lease_token uuid, p_state text, p_error_class text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_attempts integer;
BEGIN
  IF auth.role() <> 'service_role' OR p_state NOT IN ('accepted', 'retry', 'failed', 'disabled') THEN
    RAISE EXCEPTION 'Worker access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.inquiry_delivery_outbox job
  SET state = p_state, attempts = job.attempts + 1,
    next_retry_at = CASE WHEN p_state = 'retry'
      THEN now() + make_interval(secs => LEAST(3600, 30 * power(2, LEAST(job.attempts, 7))::integer))
      ELSE job.next_retry_at END,
    accepted_at = CASE WHEN p_state = 'accepted' THEN now() ELSE job.accepted_at END,
    last_error_class = left(p_error_class, 100),
    lease_token = NULL, locked_until = NULL, updated_at = now()
  WHERE job.id = p_id AND job.lease_token = p_lease_token AND job.state = 'sending'
  RETURNING job.attempts INTO v_attempts;
  RETURN v_attempts IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_inquiry_delivery_jobs(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_inquiry_delivery_job(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_inquiry_delivery_jobs(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_inquiry_delivery_job(uuid, uuid, text, text) TO service_role;
