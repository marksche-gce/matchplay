-- Enable RLS on player views to fix security definer view issue
ALTER TABLE players_simple ENABLE ROW LEVEL SECURITY;
ALTER TABLE players_secure ENABLE ROW LEVEL SECURITY;
ALTER TABLE players_public ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for players_public (limited data, can be viewed by authenticated users)
CREATE POLICY "Authenticated users can view public player data"
ON players_public
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create RLS policies for players_simple (sensitive data filtered in view logic)
CREATE POLICY "Users can view simple player data"
ON players_simple
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create RLS policies for players_secure (most restrictive)
CREATE POLICY "Users can view secure player data with restrictions"
ON players_secure
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- System admins can see everything
    is_system_admin(auth.uid()) OR
    -- Tenant organizers can see players in their tenant
    EXISTS (
      SELECT 1 
      FROM players p
      JOIN user_roles ur ON ur.tenant_id = p.tenant_id AND ur.user_id = auth.uid()
      WHERE p.id = players_secure.id
        AND ur.role = ANY (ARRAY['tenant_admin'::tenant_role, 'organizer'::tenant_role, 'manager'::tenant_role])
    ) OR
    -- Users can see their own data
    EXISTS (
      SELECT 1 
      FROM players p
      WHERE p.id = players_secure.id AND p.user_id = auth.uid()
    )
  )
);