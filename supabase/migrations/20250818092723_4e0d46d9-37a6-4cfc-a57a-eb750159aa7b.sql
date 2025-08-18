-- Remove duplicate organizer role for markus.schenker@icloud.com, keep only tenant_admin
DELETE FROM user_roles 
WHERE user_id = 'bcd78f00-921d-4106-b0b3-695963697e9b' 
  AND tenant_id = 'd32735bd-4519-4217-b0eb-755446da7f52' 
  AND role = 'organizer';