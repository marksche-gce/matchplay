-- Update markus.schenker@icloud.com to be tenant_admin for Golfclub Ennetsee
INSERT INTO user_roles (user_id, tenant_id, role) 
VALUES ('bcd78f00-921d-4106-b0b3-695963697e9b', 'd32735bd-4519-4217-b0eb-755446da7f52', 'tenant_admin')
ON CONFLICT (user_id, tenant_id) 
DO UPDATE SET role = 'tenant_admin';