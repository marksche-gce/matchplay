-- Step 1: Create tenants table and basic structure
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

-- Add tenant_id to existing tables
ALTER TABLE public.tournaments ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.players ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.teams ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Update existing data with the default tenant
UPDATE public.tournaments SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'standard' LIMIT 1) WHERE tenant_id IS NULL;
UPDATE public.players SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'standard' LIMIT 1) WHERE tenant_id IS NULL;
UPDATE public.teams SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'standard' LIMIT 1) WHERE tenant_id IS NULL;

-- Make tenant_id required for key tables
ALTER TABLE public.tournaments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.players ALTER COLUMN tenant_id SET NOT NULL;