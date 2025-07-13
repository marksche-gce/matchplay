-- Grant organizer role to the current user
UPDATE user_roles 
SET role = 'organizer' 
WHERE user_id = 'bcd78f00-921d-4106-b0b3-695963697e9b';