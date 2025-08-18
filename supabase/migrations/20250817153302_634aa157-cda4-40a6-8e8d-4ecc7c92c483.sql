-- Create tenants table for golf clubs
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  website TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Create tenant admin role
CREATE TYPE public.tenant_role AS ENUM ('tenant_admin', 'organizer', 'player');

-- Update user_roles to include tenant_id and new role types
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles DROP COLUMN role;
ALTER TABLE public.user_roles ADD COLUMN role tenant_role NOT NULL DEFAULT 'player';
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_tenant_role_key UNIQUE (user_id, tenant_id, role);

-- Add tenant_id to all existing tables
ALTER TABLE public.tournaments ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.tournaments_new ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.players ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.players_new ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.teams ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Update functions for tenant support
CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id uuid, _tenant_id uuid, _role tenant_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_tenant_role(_tenant_id uuid)
RETURNS tenant_role
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT role 
  FROM public.user_roles 
  WHERE user_id = auth.uid() 
    AND tenant_id = _tenant_id
  ORDER BY 
    CASE role 
      WHEN 'tenant_admin' THEN 1 
      WHEN 'organizer' THEN 2 
      WHEN 'player' THEN 3 
    END 
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT has_tenant_role(_user_id, _tenant_id, 'tenant_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_organizer(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT has_tenant_role(_user_id, _tenant_id, 'organizer') OR has_tenant_role(_user_id, _tenant_id, 'tenant_admin');
$$;

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

CREATE POLICY "Super admins can manage all tenants" 
ON public.tenants 
FOR ALL 
USING (has_role(auth.uid(), 'admin'));

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
  has_role(auth.uid(), 'admin') OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND tenant_id = tournaments.tenant_id
  )
);

CREATE POLICY "Tenant organizers can manage tournaments" 
ON public.tournaments 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin') OR 
  is_tenant_organizer(auth.uid(), tenant_id)
);

-- Update RLS policies for players
DROP POLICY IF EXISTS "Users can insert their own player profile" ON public.players;
DROP POLICY IF EXISTS "Users can update their own player profile" ON public.players;
DROP POLICY IF EXISTS "Users can view player data" ON public.players;

CREATE POLICY "Users can view players in their tenant" 
ON public.players 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin') OR
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
  has_role(auth.uid(), 'admin') OR
  is_tenant_admin(auth.uid(), tenant_id)
);

CREATE POLICY "Tenant admins can manage roles in their tenant" 
ON public.user_roles 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin') OR 
  is_tenant_admin(auth.uid(), tenant_id)
);

-- Update trigger for new users to assign to a tenant
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  default_tenant_id uuid;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, display_name, username)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'display_name',
    NEW.raw_user_meta_data ->> 'username'
  );
  
  -- Get tenant_id from metadata or use a default
  default_tenant_id := (NEW.raw_user_meta_data ->> 'tenant_id')::uuid;
  
  -- If no tenant specified, skip role assignment (will be handled by admin)
  IF default_tenant_id IS NOT NULL THEN
    -- Assign player role in the specified tenant
    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (NEW.id, default_tenant_id, 'player');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create function to get user's tenants
CREATE OR REPLACE FUNCTION public.get_user_tenants(_user_id uuid)
RETURNS TABLE (
  tenant_id uuid,
  tenant_name text,
  tenant_slug text,
  user_role tenant_role
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT 
    ur.tenant_id,
    t.name,
    t.slug,
    ur.role
  FROM public.user_roles ur
  JOIN public.tenants t ON ur.tenant_id = t.id
  WHERE ur.user_id = _user_id
  ORDER BY 
    CASE ur.role 
      WHEN 'tenant_admin' THEN 1 
      WHEN 'organizer' THEN 2 
      WHEN 'player' THEN 3 
    END,
    t.name;
$$;

-- Insert a default tenant for existing data
INSERT INTO public.tenants (name, slug, description) 
VALUES ('Standard Golf Club', 'standard', 'Default tenant for existing data');

-- Update existing data with the default tenant
UPDATE public.tournaments SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'standard' LIMIT 1) WHERE tenant_id IS NULL;
UPDATE public.players SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'standard' LIMIT 1) WHERE tenant_id IS NULL;
UPDATE public.user_roles SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'standard' LIMIT 1) WHERE tenant_id IS NULL;

-- Make tenant_id required for key tables
ALTER TABLE public.tournaments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.players ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.user_roles ALTER COLUMN tenant_id SET NOT NULL;