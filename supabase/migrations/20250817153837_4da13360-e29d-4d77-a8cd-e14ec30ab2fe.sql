-- Step 2: Create tenant roles and update user_roles table
CREATE TYPE public.tenant_role AS ENUM ('tenant_admin', 'organizer', 'player');

-- Add tenant_id to user_roles
ALTER TABLE public.user_roles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Update existing user_roles with default tenant
UPDATE public.user_roles SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'standard' LIMIT 1) WHERE tenant_id IS NULL;

-- Make tenant_id required
ALTER TABLE public.user_roles ALTER COLUMN tenant_id SET NOT NULL;

-- Add new role column
ALTER TABLE public.user_roles ADD COLUMN new_role tenant_role;

-- Migrate existing role data
UPDATE public.user_roles SET new_role = 
  CASE 
    WHEN role = 'admin' THEN 'tenant_admin'::tenant_role
    WHEN role = 'organizer' THEN 'organizer'::tenant_role
    ELSE 'player'::tenant_role
  END;

-- Make new_role required
ALTER TABLE public.user_roles ALTER COLUMN new_role SET NOT NULL;

-- Drop old constraints and column
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles DROP COLUMN role;

-- Rename new column
ALTER TABLE public.user_roles RENAME COLUMN new_role TO role;

-- Add new unique constraint
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_tenant_role_key UNIQUE (user_id, tenant_id, role);