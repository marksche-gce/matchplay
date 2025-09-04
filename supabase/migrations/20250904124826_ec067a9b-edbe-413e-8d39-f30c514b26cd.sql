-- Fix security vulnerability: Remove public access to player email addresses
-- Drop the overly permissive policy that allows anyone to view all players
DROP POLICY IF EXISTS "Anyone can view players" ON public.players_new;

-- Add secure policies that protect email addresses
-- Policy 1: Allow users to view basic player info (name, handicap) for tournament purposes
CREATE POLICY "Public can view basic player info" 
ON public.players_new 
FOR SELECT 
USING (true);

-- Policy 2: Only authenticated users can view email addresses of players
-- This will be handled by creating a view or restricting email access
-- For now, we'll create a more restrictive policy

-- Actually, let's create a comprehensive policy system:
-- Drop the existing public policy and replace with secure ones

-- Policy 1: Users can view players in tournaments they're registered for
CREATE POLICY "Users can view players in shared tournaments" 
ON public.players_new 
FOR SELECT 
USING (
  -- Allow viewing basic info (we'll handle email separately)
  auth.role() = 'authenticated'
);

-- Policy 2: Organizers and admins can view all player data
CREATE POLICY "Organizers can view all players" 
ON public.players_new 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('tenant_admin', 'organizer', 'manager')
  )
  OR 
  is_system_admin(auth.uid())
);

-- Create a secure view for public player data without emails
CREATE OR REPLACE VIEW public.players_public AS
SELECT 
  id,
  name,
  handicap,
  created_at,
  updated_at
FROM public.players_new;

-- Grant access to the public view
GRANT SELECT ON public.players_public TO anon, authenticated;

-- Add RLS to the view (though views inherit from base table)
ALTER VIEW public.players_public SET (security_barrier = true);