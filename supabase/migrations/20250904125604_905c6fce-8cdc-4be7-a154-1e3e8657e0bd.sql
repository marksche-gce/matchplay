-- Fix critical security vulnerability in players_simple table
-- Enable RLS and create secure policies to protect personal information

-- Enable Row Level Security on players_simple table
ALTER TABLE public.players_simple ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view and update their own player data
CREATE POLICY "Users can manage their own player data" 
ON public.players_simple 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 2: Organizers and admins can view all player data (full access)
CREATE POLICY "Organizers and admins can view all players" 
ON public.players_simple 
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

-- Policy 3: Organizers and admins can insert player data
CREATE POLICY "Organizers and admins can insert players" 
ON public.players_simple 
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('tenant_admin', 'organizer', 'manager')
  )
  OR 
  is_system_admin(auth.uid())
);

-- Policy 4: Organizers and admins can update player data
CREATE POLICY "Organizers and admins can update players" 
ON public.players_simple 
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('tenant_admin', 'organizer', 'manager')
  )
  OR 
  is_system_admin(auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('tenant_admin', 'organizer', 'manager')
  )
  OR 
  is_system_admin(auth.uid())
);

-- Policy 5: Organizers and admins can delete player data
CREATE POLICY "Organizers and admins can delete players" 
ON public.players_simple 
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('tenant_admin', 'organizer', 'manager')
  )
  OR 
  is_system_admin(auth.uid())
);

-- Create a public view for non-sensitive data
CREATE OR REPLACE VIEW public.players_simple_public AS
SELECT 
  id,
  name,
  handicap,
  created_at,
  updated_at
FROM public.players_simple;

-- Grant access to the public view
GRANT SELECT ON public.players_simple_public TO anon, authenticated;