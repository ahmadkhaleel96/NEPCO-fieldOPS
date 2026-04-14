-- Migration 018: Supabase Auth hook — inject role claim into JWT
-- This function is registered as a "custom access token" hook in the Supabase dashboard
-- under: Authentication > Hooks > Custom Access Token Hook
--
-- It reads the user's role from the public.users table and injects it as a
-- custom JWT claim so that RLS policies can read it via auth.jwt() ->> 'role'.

CREATE OR REPLACE FUNCTION public.inject_role_claim(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims    JSONB;
  user_role TEXT;
BEGIN
  -- Fetch the user's role from the public users table
  SELECT role::TEXT INTO user_role
  FROM public.users
  WHERE auth_id = (event ->> 'user_id')::UUID;

  -- If the user has no profile yet (e.g., during initial setup), deny access
  IF user_role IS NULL THEN
    RAISE EXCEPTION 'No user profile found for auth_id: %', event ->> 'user_id';
  END IF;

  claims = event -> 'claims';
  claims = jsonb_set(claims, '{role}', to_jsonb(user_role));

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant execute permission to the supabase_auth_admin role
GRANT EXECUTE ON FUNCTION public.inject_role_claim TO supabase_auth_admin;
