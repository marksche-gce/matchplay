-- Update the default tenant name to "Golfclub Ennetsee"
UPDATE public.tenants 
SET 
  name = 'Golfclub Ennetsee',
  slug = 'golfclub-ennetsee',
  description = 'Golfclub Ennetsee - Ihr Premium Golfclub'
WHERE slug = 'standard';