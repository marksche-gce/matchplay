-- Add admin role for the user
INSERT INTO public.user_roles (user_id, role) 
VALUES ('bcd78f00-921d-4106-b0b3-695963697e9b', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;