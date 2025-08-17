-- Promote current tenant admin to system admin
-- First, find the tenant admin from Golfclub Ennetsee and make them system admin

INSERT INTO public.system_roles (user_id, role)
SELECT DISTINCT ur.user_id, 'system_admin'::system_role
FROM public.user_roles ur
JOIN public.tenants t ON ur.tenant_id = t.id
WHERE ur.role = 'tenant_admin' 
  AND t.slug = 'golfclub-ennetsee'
ON CONFLICT (user_id) DO NOTHING;