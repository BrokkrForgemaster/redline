CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  subject text NOT NULL CHECK (length(subject) BETWEEN 3 AND 150),
  category text NOT NULL CHECK (category IN ('technical_issue', 'access', 'change_request', 'other')),
  affected_page text CHECK (length(affected_page) <= 300),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'triaged', 'in_progress', 'waiting_on_owner', 'resolved', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_tickets_recent_idx
  ON public.support_tickets(updated_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS public.support_replies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE RESTRICT,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_replies_thread_idx
  ON public.support_replies(ticket_id, created_at, id);

CREATE TABLE IF NOT EXISTS public.support_status_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  old_status text NOT NULL,
  new_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_status_events_ticket_idx
  ON public.support_status_events(ticket_id, created_at, id);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_status_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_tickets_scoped_read ON public.support_tickets
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles actor
      WHERE actor.id = auth.uid() AND actor.status = 'active'
        AND coalesce(auth.jwt()->>'aal', '') = 'aal2'
        AND ((actor.role = 'owner' AND creator_id = actor.id)
          OR actor.role = 'developer'))
  );
CREATE POLICY support_replies_scoped_read ON public.support_replies
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.support_tickets ticket WHERE ticket.id = ticket_id)
  );
CREATE POLICY support_status_events_scoped_read ON public.support_status_events
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.support_tickets ticket WHERE ticket.id = ticket_id)
  );

CREATE OR REPLACE FUNCTION public.create_support_ticket(
  p_subject text, p_category text, p_affected_page text, p_body text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_ticket uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id = v_actor AND role = 'owner' AND status = 'active')
    OR coalesce(auth.jwt()->>'aal', '') <> 'aal2' THEN
    RAISE EXCEPTION 'Active owner with MFA required' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_subject, ''))) NOT BETWEEN 3 AND 150 OR
     p_category NOT IN ('technical_issue', 'access', 'change_request', 'other') OR
     length(coalesce(p_affected_page, '')) > 300 OR
     length(trim(coalesce(p_body, ''))) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION 'Invalid support request' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.support_tickets(creator_id, subject, category, affected_page)
    VALUES (v_actor, trim(p_subject), p_category, nullif(trim(p_affected_page), ''))
    RETURNING id INTO v_ticket;
  INSERT INTO public.support_replies(ticket_id, author_id, body)
    VALUES (v_ticket, v_actor, trim(p_body));
  INSERT INTO public.notifications(user_id, type, title, body, action_url, entity_type, entity_id)
    SELECT id, 'support_request', 'New support request',
      'An owner support request is ready to review.', '/support/' || v_ticket::text,
      'support_ticket', v_ticket
    FROM public.profiles WHERE role = 'developer' AND status = 'active';
  RETURN v_ticket;
END;
$$;

CREATE OR REPLACE FUNCTION public.reply_support_ticket(p_ticket_id uuid, p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role public.app_role;
  v_ticket public.support_tickets%ROWTYPE;
  v_reply uuid;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = v_actor AND status = 'active';
  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND OR v_role IS NULL OR
     NOT (v_role = 'developer' OR (v_role = 'owner' AND v_ticket.creator_id = v_actor)) THEN
    RAISE EXCEPTION 'Support ticket unavailable' USING ERRCODE = '42501';
  END IF;
  IF coalesce(auth.jwt()->>'aal', '') <> 'aal2' THEN
    RAISE EXCEPTION 'MFA required' USING ERRCODE = '42501';
  END IF;
  IF v_ticket.status = 'closed' OR length(trim(coalesce(p_body, ''))) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION 'Cannot reply to this ticket' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.support_replies(ticket_id, author_id, body)
    VALUES (p_ticket_id, v_actor, trim(p_body)) RETURNING id INTO v_reply;
  UPDATE public.support_tickets SET updated_at = now() WHERE id = p_ticket_id;
  INSERT INTO public.notifications(user_id, type, title, body, action_url, entity_type, entity_id)
    SELECT recipient.id, 'support_reply', 'Support reply',
      'A support ticket has a new reply.', '/support/' || p_ticket_id::text,
      'support_ticket', p_ticket_id
    FROM public.profiles recipient
    WHERE recipient.status = 'active' AND recipient.id <> v_actor
      AND (recipient.id = v_ticket.creator_id OR recipient.role = 'developer');
  RETURN v_reply;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_support_ticket_status(p_ticket_id uuid, p_status text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role public.app_role;
  v_ticket public.support_tickets%ROWTYPE;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = v_actor AND status = 'active';
  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND OR v_role IS NULL OR
     NOT (v_role = 'developer' OR (v_role = 'owner' AND v_ticket.creator_id = v_actor)) OR
     coalesce(auth.jwt()->>'aal', '') <> 'aal2' THEN
    RAISE EXCEPTION 'Support ticket unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('open', 'triaged', 'in_progress', 'waiting_on_owner', 'resolved', 'closed') THEN
    RAISE EXCEPTION 'Invalid support status' USING ERRCODE = '22023';
  END IF;
  IF v_ticket.status = p_status THEN RETURN p_status; END IF;
  UPDATE public.support_tickets SET status = p_status, updated_at = now() WHERE id = p_ticket_id;
  INSERT INTO public.support_status_events(ticket_id, actor_id, old_status, new_status)
    VALUES (p_ticket_id, v_actor, v_ticket.status, p_status);
  INSERT INTO public.notifications(user_id, type, title, body, action_url, entity_type, entity_id)
    SELECT recipient.id, 'support_status', 'Support status changed',
      'A support ticket status has changed.', '/support/' || p_ticket_id::text,
      'support_ticket', p_ticket_id
    FROM public.profiles recipient
    WHERE recipient.status = 'active' AND recipient.id <> v_actor
      AND (recipient.id = v_ticket.creator_id OR recipient.role = 'developer');
  RETURN p_status;
END;
$$;

REVOKE ALL ON FUNCTION public.create_support_ticket(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reply_support_ticket(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.change_support_ticket_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reply_support_ticket(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_support_ticket_status(uuid, text) TO authenticated;
