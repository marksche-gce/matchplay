-- Drop the overly permissive policy that allows all users to view all player data
DROP POLICY IF EXISTS "Users can view tournament-relevant player data" ON public.players;

-- Create a more secure policy that restricts access to personal information
CREATE POLICY "Users can view limited player data based on context" 
ON public.players 
FOR SELECT 
USING (
  -- Users can always view their own profile
  auth.uid() = user_id
  OR
  -- Organizers and admins can view all player data for management
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role))
  OR
  -- Users can view other players only if they're registered for the same tournament
  EXISTS (
    SELECT 1 
    FROM tournament_registrations tr1
    JOIN tournament_registrations tr2 ON tr1.tournament_id = tr2.tournament_id
    JOIN players p ON tr1.player_id = p.id
    WHERE tr2.player_id = players.id
    AND p.user_id = auth.uid()
  )
);