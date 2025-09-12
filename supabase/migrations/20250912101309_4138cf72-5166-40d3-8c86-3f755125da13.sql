-- Drop the existing views that lack proper security
DROP VIEW IF EXISTS players_simple CASCADE;
DROP VIEW IF EXISTS players_secure CASCADE;
DROP VIEW IF EXISTS players_public CASCADE;

-- Create security definer functions instead of views for better security control
CREATE OR REPLACE FUNCTION public.get_players_public()
RETURNS TABLE (
  id uuid,
  name text,
  handicap numeric,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.name,
    p.handicap,
    p.created_at,
    p.updated_at
  FROM players_new p
  WHERE auth.uid() IS NOT NULL; -- Only authenticated users can access
$$;

CREATE OR REPLACE FUNCTION public.get_players_simple()
RETURNS TABLE (
  id uuid,
  name text,
  handicap numeric,
  created_at timestamptz,
  updated_at timestamptz,
  email text,
  phone text,
  emergency_contact text,
  user_id uuid
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.name,
    p.handicap,
    p.created_at,
    p.updated_at,
    CASE
      WHEN (
        -- System admin
        is_system_admin(auth.uid()) OR
        -- Tenant organizer who can see this player
        EXISTS (
          SELECT 1 
          FROM user_roles ur
          WHERE ur.user_id = auth.uid() 
            AND ur.tenant_id = p.tenant_id
            AND ur.role = ANY (ARRAY['tenant_admin'::tenant_role, 'organizer'::tenant_role, 'manager'::tenant_role])
        )
      ) THEN p.email
      ELSE NULL
    END AS email,
    CASE
      WHEN (
        -- System admin
        is_system_admin(auth.uid()) OR
        -- Tenant organizer who can see this player
        EXISTS (
          SELECT 1 
          FROM user_roles ur
          WHERE ur.user_id = auth.uid() 
            AND ur.tenant_id = p.tenant_id
            AND ur.role = ANY (ARRAY['tenant_admin'::tenant_role, 'organizer'::tenant_role, 'manager'::tenant_role])
        )
      ) THEN p.phone
      ELSE NULL
    END AS phone,
    CASE
      WHEN (
        -- System admin
        is_system_admin(auth.uid()) OR
        -- Tenant organizer who can see this player
        EXISTS (
          SELECT 1 
          FROM user_roles ur
          WHERE ur.user_id = auth.uid() 
            AND ur.tenant_id = p.tenant_id
            AND ur.role = ANY (ARRAY['tenant_admin'::tenant_role, 'organizer'::tenant_role, 'manager'::tenant_role])
        )
      ) THEN p.emergency_contact
      ELSE NULL
    END AS emergency_contact,
    p.user_id
  FROM players p
  WHERE (
    -- System admin can see all
    is_system_admin(auth.uid()) OR
    -- Users can see their own data
    p.user_id = auth.uid() OR
    -- Tenant organizers can see players in their tenant
    EXISTS (
      SELECT 1 
      FROM user_roles ur
      WHERE ur.user_id = auth.uid() 
        AND ur.tenant_id = p.tenant_id
        AND ur.role = ANY (ARRAY['tenant_admin'::tenant_role, 'organizer'::tenant_role, 'manager'::tenant_role])
    ) OR
    -- Users can see players in same tournaments
    EXISTS (
      SELECT 1
      FROM tournament_registrations tr1
      JOIN tournament_registrations tr2 ON tr1.tournament_id = tr2.tournament_id
      JOIN players p2 ON tr1.player_id = p2.id
      WHERE tr2.player_id = p.id 
        AND p2.user_id = auth.uid()
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_players_secure()
RETURNS TABLE (
  id uuid,
  name text,
  handicap numeric,
  created_at timestamptz,
  updated_at timestamptz,
  email text,
  phone text,
  emergency_contact text,
  user_id uuid
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.name,
    p.handicap,
    p.created_at,
    p.updated_at,
    CASE
      WHEN (
        -- System admin
        is_system_admin(auth.uid()) OR
        -- Users can see their own data
        p.user_id = auth.uid() OR
        -- Tenant organizers can see players in their tenant
        EXISTS (
          SELECT 1 
          FROM user_roles ur
          WHERE ur.user_id = auth.uid() 
            AND ur.tenant_id = p.tenant_id
            AND ur.role = ANY (ARRAY['tenant_admin'::tenant_role, 'organizer'::tenant_role, 'manager'::tenant_role])
        )
      ) THEN p.email
      ELSE NULL
    END AS email,
    CASE
      WHEN (
        -- System admin
        is_system_admin(auth.uid()) OR
        -- Users can see their own data
        p.user_id = auth.uid() OR
        -- Tenant organizers can see players in their tenant
        EXISTS (
          SELECT 1 
          FROM user_roles ur
          WHERE ur.user_id = auth.uid() 
            AND ur.tenant_id = p.tenant_id
            AND ur.role = ANY (ARRAY['tenant_admin'::tenant_role, 'organizer'::tenant_role, 'manager'::tenant_role])
        )
      ) THEN p.phone
      ELSE NULL
    END AS phone,
    CASE
      WHEN (
        -- System admin
        is_system_admin(auth.uid()) OR
        -- Users can see their own data
        p.user_id = auth.uid() OR
        -- Tenant organizers can see players in their tenant
        EXISTS (
          SELECT 1 
          FROM user_roles ur
          WHERE ur.user_id = auth.uid() 
            AND ur.tenant_id = p.tenant_id
            AND ur.role = ANY (ARRAY['tenant_admin'::tenant_role, 'organizer'::tenant_role, 'manager'::tenant_role])
        )
      ) THEN p.emergency_contact
      ELSE NULL
    END AS emergency_contact,
    CASE
      WHEN (
        -- System admin
        is_system_admin(auth.uid()) OR
        -- Users can see their own data
        p.user_id = auth.uid() OR
        -- Tenant organizers can see players in their tenant
        EXISTS (
          SELECT 1 
          FROM user_roles ur
          WHERE ur.user_id = auth.uid() 
            AND ur.tenant_id = p.tenant_id
            AND ur.role = ANY (ARRAY['tenant_admin'::tenant_role, 'organizer'::tenant_role, 'manager'::tenant_role])
        )
      ) THEN p.user_id
      ELSE NULL
    END AS user_id
  FROM players p
  WHERE (
    -- System admin can see all
    is_system_admin(auth.uid()) OR
    -- Users can see their own data
    p.user_id = auth.uid() OR
    -- Tenant organizers can see players in their tenant
    EXISTS (
      SELECT 1 
      FROM user_roles ur
      WHERE ur.user_id = auth.uid() 
        AND ur.tenant_id = p.tenant_id
        AND ur.role = ANY (ARRAY['tenant_admin'::tenant_role, 'organizer'::tenant_role, 'manager'::tenant_role])
    )
  );
$$;