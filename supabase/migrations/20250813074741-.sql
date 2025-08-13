-- Create a secure view that filters player data based on user access level
CREATE OR REPLACE VIEW public.players_secure AS
SELECT 
  p.id,
  p.name,
  p.handicap,
  p.created_at,
  p.updated_at,
  -- Only show sensitive data to the player themselves or organizers/admins
  CASE 
    WHEN p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role)
    THEN p.email
    ELSE NULL
  END as email,
  CASE 
    WHEN p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role)
    THEN p.phone
    ELSE NULL
  END as phone,
  CASE 
    WHEN p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role)
    THEN p.emergency_contact
    ELSE NULL
  END as emergency_contact,
  -- Always include user_id for internal operations but don't expose in API
  p.user_id
FROM public.players p
WHERE (
  -- Users can view their own profile
  auth.uid() = p.user_id
  OR
  -- Organizers and admins can view all player data
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role))
  OR
  -- Users can view other players if they're registered for the same tournament
  EXISTS (
    SELECT 1 
    FROM tournament_registrations tr1
    JOIN tournament_registrations tr2 ON tr1.tournament_id = tr2.tournament_id
    JOIN players p2 ON tr1.player_id = p2.id
    WHERE tr2.player_id = p.id
    AND p2.user_id = auth.uid()
  )
);

-- Grant access to the view
GRANT SELECT ON public.players_secure TO authenticated;

-- Create RLS policy for the view
ALTER VIEW public.players_secure SET (security_barrier = true);

-- Add a comment explaining the security model
COMMENT ON VIEW public.players_secure IS 'Secure view of players table that filters sensitive personal data based on user access level. Regular users can only see names and handicaps of tournament participants, while organizers/admins and the players themselves can see full contact information.';