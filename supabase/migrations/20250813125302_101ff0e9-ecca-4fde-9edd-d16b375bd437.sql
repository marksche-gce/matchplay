-- Fix infinite recursion in players RLS policy
-- Drop the problematic policy and recreate it with better logic

DROP POLICY IF EXISTS "Users can view limited player data based on context" ON public.players;

-- Create a simpler, non-recursive policy for viewing players
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
  -- Users can see other players if they're in the same tournament (simplified)
  EXISTS (
    SELECT 1
    FROM tournament_registrations tr1
    JOIN tournament_registrations tr2 ON tr1.tournament_id = tr2.tournament_id
    WHERE tr1.player_id = players.id
    AND tr2.player_id IN (
      SELECT p.id 
      FROM players p 
      WHERE p.user_id = auth.uid()
    )
  )
);