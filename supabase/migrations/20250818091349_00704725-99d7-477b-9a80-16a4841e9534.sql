-- Update Giani's role from organizer to tenant_admin
UPDATE user_roles 
SET role = 'tenant_admin' 
WHERE user_id = '9cb44862-bf28-4b58-8152-50ce5146ec10' 
  AND role = 'organizer';