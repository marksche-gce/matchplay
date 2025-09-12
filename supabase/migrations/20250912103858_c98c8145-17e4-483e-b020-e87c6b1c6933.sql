-- Fix security issue: Add proper RLS policies to protect player email addresses from spam harvesting
-- Currently only organizers can view players, but we need to add policies for regular users

-- Add SELECT policy for authenticated users with proper restrictions
CREATE POLICY "Authenticated users can view players with limited access"
ON players_new
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- System admins can see all players
    is_system_admin(auth.uid()) OR
    -- Tenant organizers can see all players (already covered by existing policy but for clarity)
    EXISTS (
      SELECT 1
      FROM user_roles ur
      WHERE ur.user_id = auth.uid() 
        AND ur.role = ANY (ARRAY['tenant_admin'::tenant_role, 'organizer'::tenant_role, 'manager'::tenant_role])
    ) OR
    -- Users can see players they are registered with in tournaments
    EXISTS (
      SELECT 1
      FROM tournament_registrations_new tr1
      JOIN tournament_registrations_new tr2 ON tr1.tournament_id = tr2.tournament_id
      JOIN tournaments_new t ON tr1.tournament_id = t.id
      JOIN user_roles ur ON ur.tenant_id = t.tenant_id AND ur.user_id = auth.uid()
      WHERE tr2.player_id = players_new.id
        AND tr1.player_id IN (
          SELECT p.id 
          FROM players p 
          WHERE p.user_id = auth.uid()
        )
    )
  )
);

-- Update the INSERT policy to be more restrictive and ensure proper tenant association
DROP POLICY IF EXISTS "Anyone can register as player" ON players_new;

CREATE POLICY "Authenticated users can register as players"
ON players_new
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    -- System admins can create players
    is_system_admin(auth.uid()) OR
    -- Tenant organizers can create players
    EXISTS (
      SELECT 1
      FROM user_roles ur
      WHERE ur.user_id = auth.uid() 
        AND ur.role = ANY (ARRAY['tenant_admin'::tenant_role, 'organizer'::tenant_role, 'manager'::tenant_role])
    )
  )
);