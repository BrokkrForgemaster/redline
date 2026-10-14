-- New identities never receive operational access from client-controlled metadata.
-- Existing profiles are deliberately unchanged; invitation activation needs a
-- separate, audited owner-controlled command.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  email_name text;
BEGIN
  email_name := split_part(coalesce(NEW.email, ''), '@', 1);
  INSERT INTO public.profiles (id, email, first_name, last_name, role, status)
  VALUES (
    NEW.id,
    coalesce(NEW.email, ''),
    coalesce(nullif(initcap(regexp_replace(email_name, '[^a-zA-Z]+', ' ', 'g')), ''), 'New'),
    'User',
    'crew_member',
    'invited'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
