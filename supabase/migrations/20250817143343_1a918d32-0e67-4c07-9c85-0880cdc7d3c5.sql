-- Create edge function for admin user creation
CREATE OR REPLACE FUNCTION create_admin_user(
  user_email text,
  user_password text,
  user_display_name text,
  user_role app_role
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id uuid;
  result json;
BEGIN
  -- Check if current user is admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied. Only admins can create users.';
  END IF;

  -- Validate input
  IF user_email IS NULL OR user_password IS NULL OR user_display_name IS NULL THEN
    RAISE EXCEPTION 'Missing required fields';
  END IF;

  -- This function should be called from an Edge Function
  -- as we cannot directly create auth users from SQL
  
  -- Return a success response structure
  SELECT json_build_object(
    'success', true,
    'message', 'User creation request validated'
  ) INTO result;

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    SELECT json_build_object(
      'success', false,
      'error', SQLERRM
    ) INTO result;
    RETURN result;
END;
$$;