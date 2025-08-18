-- Update existing functions to handle manager role properly
-- Manager can organize tournaments like organizer but cannot manage users
CREATE OR REPLACE FUNCTION public.is_tenant_manager(_user_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $$
  SELECT has_tenant_role(_user_id, _tenant_id, 'manager');
$$;

-- Update the is_tenant_organizer function to include managers for tournament management
CREATE OR REPLACE FUNCTION public.is_tenant_organizer(_user_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $$
  SELECT has_tenant_role(_user_id, _tenant_id, 'organizer') OR has_tenant_role(_user_id, _tenant_id, 'manager') OR has_tenant_role(_user_id, _tenant_id, 'tenant_admin');
$$;