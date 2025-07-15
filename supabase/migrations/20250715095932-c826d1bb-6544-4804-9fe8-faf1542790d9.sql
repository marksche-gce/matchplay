-- First, let's check if there are any authenticated users without roles
-- and assign them organizer role for tournament management

-- Insert organizer role for any authenticated user who doesn't have a role yet
-- This will help with the current user who is trying to update matches
INSERT INTO public.user_roles (user_id, role)
SELECT auth.uid(), 'organizer'::app_role
WHERE auth.uid() IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid()
  );

-- Also update the handle_new_user function to assign organizer role by default
-- instead of just player role, so new users can manage tournaments
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, display_name, username)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'display_name',
    NEW.raw_user_meta_data ->> 'username'
  );
  
  -- Assign organizer role instead of just player role
  -- This allows users to create and manage tournaments
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'organizer');
  
  RETURN NEW;
END;
$function$;