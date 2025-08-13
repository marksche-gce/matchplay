-- Fix the infinite recursion by using security definer functions
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view player data" ON public.players;

-- Create a security definer function to get current user's player ID
CREATE OR REPLACE FUNCTION public.get_current_user_player_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM public.players WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Create a simpler policy without recursion
CREATE POLICY "Users can view player data" 
ON public.players 
FOR SELECT 
USING (
  -- Users can see their own data
  auth.uid() = user_id
  OR 
  -- Admins and organizers can see all data
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role))
  OR
  -- Users can see other players if they're in the same tournament
  EXISTS (
    SELECT 1
    FROM tournament_registrations tr1
    JOIN tournament_registrations tr2 ON tr1.tournament_id = tr2.tournament_id
    WHERE tr1.player_id = players.id
    AND tr2.player_id = public.get_current_user_player_id()
  )
);