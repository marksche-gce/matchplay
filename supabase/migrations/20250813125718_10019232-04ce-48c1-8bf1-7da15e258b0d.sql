-- Check and fix the infinite recursion issue completely
-- The problem might still exist with tournament_registrations

-- First, check if tournament_registrations has recursive policies too
DROP POLICY IF EXISTS "Users can view their own registrations" ON public.tournament_registrations;
DROP POLICY IF EXISTS "Organizers can view registrations for their tournaments" ON public.tournament_registrations;

-- Create safe, non-recursive policies for tournament_registrations
CREATE POLICY "Users can view their own registrations" 
ON public.tournament_registrations 
FOR SELECT 
USING (
  -- Check if current user owns the player associated with this registration
  EXISTS (
    SELECT 1 
    FROM public.players p 
    WHERE p.id = tournament_registrations.player_id 
    AND p.user_id = auth.uid()
  )
  OR
  -- Allow admins and organizers to see all registrations
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role))
);

CREATE POLICY "Organizers can view all registrations" 
ON public.tournament_registrations 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role)
);

-- Create a simple view for player data that avoids recursion
CREATE OR REPLACE VIEW public.players_simple AS
SELECT 
  id,
  name,
  handicap,
  CASE 
    WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role) THEN email
    ELSE NULL
  END as email,
  CASE 
    WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role) THEN phone
    ELSE NULL
  END as phone,
  CASE 
    WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role) THEN emergency_contact
    ELSE NULL
  END as emergency_contact,
  CASE 
    WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role) THEN user_id
    ELSE NULL
  END as user_id,
  created_at,
  updated_at
FROM public.players;