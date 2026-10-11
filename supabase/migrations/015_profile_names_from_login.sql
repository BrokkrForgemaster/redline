-- Replace generic signup names for known privileged users and make future
-- profile creation derive a readable name from the login when metadata is absent.

UPDATE profiles
SET first_name = 'Ryan',
    last_name = 'Gretz',
    updated_at = NOW()
WHERE lower(email) IN ('ryangretz@gmail.com', 'ryangretz07@gmail.com')
  AND lower(first_name || ' ' || last_name) = 'new user';

UPDATE profiles
SET first_name = 'Chad',
    last_name = 'Powell',
    updated_at = NOW()
WHERE lower(email) IN ('chada.powell@outlook.com', 'chad.powell0@gmail.com')
  AND lower(first_name || ' ' || last_name) = 'new user';

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  assigned_role app_role;
  email_name TEXT;
  derived_first_name TEXT;
  derived_last_name TEXT;
BEGIN
  assigned_role :=
    CASE lower(NEW.email)
      WHEN 'ryangretz@gmail.com' THEN 'administrator'::app_role
      WHEN 'ryangretz07@gmail.com' THEN 'administrator'::app_role
      WHEN 'chada.powell@outlook.com' THEN 'owner'::app_role
      WHEN 'chad.powell0@gmail.com' THEN 'owner'::app_role
      ELSE COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'crew_member')
    END;

  email_name := split_part(COALESCE(NEW.email, ''), '@', 1);
  derived_first_name := NULLIF(initcap(regexp_replace(split_part(email_name, '.', 1), '[^a-zA-Z]+', ' ', 'g')), '');
  derived_last_name := NULLIF(initcap(regexp_replace(split_part(email_name, '.', 2), '[^a-zA-Z]+', ' ', 'g')), '');

  INSERT INTO profiles (id, email, first_name, last_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'first_name', ''), derived_first_name, NEW.email),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'last_name', ''), derived_last_name, ''),
    assigned_role,
    'active'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      role = assigned_role,
      status = 'active',
      updated_at = NOW();

  RETURN NEW;
END;
$$;
