-- Fix Security Definer View issue (corrected approach)
-- Remove the security_barrier setting that makes the view a security definer view
-- Views inherit RLS policies from base tables automatically, no need to enable RLS on views

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

-- Views automatically inherit RLS policies from their base tables
-- No need to set security_barrier or enable RLS on the view itself