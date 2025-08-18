-- Add mark@masche.ch as system admin
INSERT INTO public.system_roles (user_id, role)
VALUES ('a89de496-d35e-45f1-9d99-147db1faa035', 'system_admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'system_admin';