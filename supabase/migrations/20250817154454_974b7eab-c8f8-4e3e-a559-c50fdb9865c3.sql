-- Step 4: Update RLS policies for multi-tenant system

-- RLS Policies for tenants
CREATE POLICY "Users can view tenants they belong to" 
ON public.tenants 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND tenant_id = tenants.id
  )
);

CREATE POLICY "Tenant admins can update their tenant" 
ON public.tenants 
FOR UPDATE 
USING (is_tenant_admin(auth.uid(), id));

-- Update RLS policies for tournaments
DROP POLICY IF EXISTS "Anyone can view active tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Admins and organizers can view all tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Admins and organizers can create tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Admins and organizers can update tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Admins and organizers can delete tournaments" ON public.tournaments;

CREATE POLICY "Users can view tournaments in their tenant" 
ON public.tournaments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND tenant_id = tournaments.tenant_id
  )
);

CREATE POLICY "Tenant organizers can manage tournaments" 
ON public.tournaments 
FOR ALL 
USING (is_tenant_organizer(auth.uid(), tenant_id));

-- Update RLS policies for players
DROP POLICY IF EXISTS "Users can insert their own player profile" ON public.players;
DROP POLICY IF EXISTS "Users can update their own player profile" ON public.players;
DROP POLICY IF EXISTS "Users can view player data" ON public.players;

CREATE POLICY "Users can view players in their tenant" 
ON public.players 
FOR SELECT 
USING (
  (auth.uid() = user_id) OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND tenant_id = players.tenant_id
  )
);

CREATE POLICY "Users can create player profile in their tenant" 
ON public.players 
FOR INSERT 
WITH CHECK (
  (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND tenant_id = players.tenant_id
  )) OR
  is_tenant_organizer(auth.uid(), tenant_id)
);

CREATE POLICY "Users can update their own profile or tenant organizers can update" 
ON public.players 
FOR UPDATE 
USING (
  (auth.uid() = user_id) OR 
  is_tenant_organizer(auth.uid(), tenant_id)
);

-- Update user_roles policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can assign roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;

CREATE POLICY "Users can view their own tenant roles" 
ON public.user_roles 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  is_tenant_admin(auth.uid(), tenant_id)
);

CREATE POLICY "Tenant admins can manage roles in their tenant" 
ON public.user_roles 
FOR ALL 
USING (is_tenant_admin(auth.uid(), tenant_id));

-- Update teams policies
CREATE POLICY "Users can view teams in their tenant" 
ON public.teams 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND tenant_id = teams.tenant_id
  )
);

CREATE POLICY "Tenant organizers can manage teams" 
ON public.teams 
FOR ALL 
USING (is_tenant_organizer(auth.uid(), tenant_id));