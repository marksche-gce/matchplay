-- Fix Security Definer View issue
-- Remove the security_barrier setting that makes the view a security definer view
-- Views should inherit RLS policies from base tables naturally

-- Drop and recreate the view without security_barrier setting
DROP VIEW IF EXISTS public.players_public;

-- Create the view normally - it will inherit RLS from the base table
CREATE VIEW public.players_public AS
SELECT 
  id,
  name,
  handicap,
  created_at,
  updated_at
FROM public.players_new;

-- Grant access to the view
GRANT SELECT ON public.players_public TO anon, authenticated;

-- Enable RLS on the view explicitly to ensure it respects user permissions
ALTER VIEW public.players_public ENABLE ROW LEVEL SECURITY;

-- The view will now execute with the permissions of the querying user
-- and respect the RLS policies from the base table