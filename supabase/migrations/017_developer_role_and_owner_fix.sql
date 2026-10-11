-- Ryan owns/administers the business. Chad is the technical developer, not the owner.

UPDATE profiles
SET role = 'owner',
    status = 'active',
    first_name = 'Ryan',
    last_name = 'Gretz',
    updated_at = NOW()
WHERE lower(email) IN ('ryangretz@gmail.com', 'ryangretz07@gmail.com');

UPDATE profiles
SET role = 'developer',
    status = 'active',
    first_name = 'Chad',
    last_name = 'Powell',
    updated_at = NOW()
WHERE lower(email) IN ('chada.powell@outlook.com', 'chad.powell0@gmail.com');

CREATE OR REPLACE FUNCTION is_owner_or_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('owner', 'administrator', 'developer')
    AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION is_financial_role()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('owner', 'administrator', 'developer', 'office_manager', 'bookkeeper')
    AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION can_manage_field_work()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('owner', 'administrator', 'developer', 'operations_manager', 'crew_leader', 'snow_operations_manager')
    AND status = 'active'
  )
$$;

INSERT INTO role_permissions (role, permission)
SELECT 'developer'::app_role, name FROM permissions
ON CONFLICT (role, permission) DO NOTHING;

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
      WHEN 'ryangretz@gmail.com' THEN 'owner'::app_role
      WHEN 'ryangretz07@gmail.com' THEN 'owner'::app_role
      WHEN 'chada.powell@outlook.com' THEN 'developer'::app_role
      WHEN 'chad.powell0@gmail.com' THEN 'developer'::app_role
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
