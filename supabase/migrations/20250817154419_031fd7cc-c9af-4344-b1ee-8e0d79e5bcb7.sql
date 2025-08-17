-- Step 3: Create functions and RLS policies for multi-tenant system

-- Create tenant helper functions
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

-- Update has_role function to work with system admins
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'tenant_admin'::tenant_role
      AND _role = 'admin'::app_role
  );
$$;