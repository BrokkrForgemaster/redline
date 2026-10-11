-- Ensure the named privileged accounts receive the correct database roles.
-- Chad is stored as owner so existing RLS policies grant full access; the app
-- presents him as developer through the effective-role layer.

UPDATE profiles
SET role = 'administrator',
    status = 'active',
    updated_at = NOW()
WHERE lower(email) = 'ryangretz@gmail.com';

UPDATE profiles
SET role = 'administrator',
    status = 'active',
    updated_at = NOW()
WHERE lower(email) = 'ryangretz07@gmail.com';

UPDATE profiles
SET role = 'owner',
    status = 'active',
    updated_at = NOW()
WHERE lower(email) = 'chada.powell@outlook.com';

UPDATE profiles
SET role = 'owner',
    status = 'active',
    updated_at = NOW()
WHERE lower(email) = 'chad.powell0@gmail.com';

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  assigned_role app_role;
BEGIN
  assigned_role :=
    CASE lower(NEW.email)
      WHEN 'ryangretz@gmail.com' THEN 'administrator'::app_role
      WHEN 'ryangretz07@gmail.com' THEN 'administrator'::app_role
      WHEN 'chada.powell@outlook.com' THEN 'owner'::app_role
      WHEN 'chad.powell0@gmail.com' THEN 'owner'::app_role
      ELSE COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'crew_member')
    END;

  INSERT INTO profiles (id, email, first_name, last_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'New'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
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
