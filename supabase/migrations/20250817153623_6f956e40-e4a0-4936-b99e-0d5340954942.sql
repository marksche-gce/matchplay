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

-- Insert a default tenant for existing data
INSERT INTO public.tenants (name, slug, description) 
VALUES ('Standard Golf Club', 'standard', 'Default tenant for existing data');

-- Create tenant admin role
CREATE TYPE public.tenant_role AS ENUM ('tenant_admin', 'organizer', 'player');

-- Add tenant_id to all existing tables
ALTER TABLE public.tournaments ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.tournaments_new ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.players ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.players_new ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.teams ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Update existing data with the default tenant
UPDATE public.tournaments SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'standard' LIMIT 1) WHERE tenant_id IS NULL;
UPDATE public.players SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'standard' LIMIT 1) WHERE tenant_id IS NULL;

-- Make tenant_id required for key tables
ALTER TABLE public.tournaments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.players ALTER COLUMN tenant_id SET NOT NULL;

-- Create new user_roles table with tenant support
CREATE TABLE public.user_roles_new (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role tenant_role NOT NULL DEFAULT 'player',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, role)
);

-- Enable RLS on new user_roles table
ALTER TABLE public.user_roles_new ENABLE ROW LEVEL SECURITY;

-- Migrate existing data to new table structure
INSERT INTO public.user_roles_new (user_id, tenant_id, role)
SELECT DISTINCT 
  ur.user_id, 
  (SELECT id FROM public.tenants WHERE slug = 'standard' LIMIT 1),
  CASE 
    WHEN ur.role = 'admin' THEN 'tenant_admin'::tenant_role
    WHEN ur.role = 'organizer' THEN 'organizer'::tenant_role
    ELSE 'player'::tenant_role
  END
FROM public.user_roles ur
ON CONFLICT (user_id, tenant_id, role) DO NOTHING;

-- Drop old table and rename new one
DROP TABLE public.user_roles;
ALTER TABLE public.user_roles_new RENAME TO user_roles;