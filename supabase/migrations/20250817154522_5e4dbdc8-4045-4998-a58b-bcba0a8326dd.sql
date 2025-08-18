-- Step 5: Update trigger for new users with tenant support

-- Update trigger for new users to assign to a tenant
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  default_tenant_id uuid;
  tenant_slug text;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, display_name, username)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'display_name',
    NEW.raw_user_meta_data ->> 'username'
  );
  
  -- Get tenant info from metadata
  tenant_slug := NEW.raw_user_meta_data ->> 'tenant_slug';
  
  -- If tenant slug provided, find the tenant
  IF tenant_slug IS NOT NULL THEN
    SELECT id INTO default_tenant_id 
    FROM public.tenants 
    WHERE slug = tenant_slug 
    LIMIT 1;
  END IF;
  
  -- If still no tenant, use the default one
  IF default_tenant_id IS NULL THEN
    SELECT id INTO default_tenant_id 
    FROM public.tenants 
    WHERE slug = 'standard' 
    LIMIT 1;
  END IF;
  
  -- Assign player role in the tenant
  IF default_tenant_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (NEW.id, default_tenant_id, 'player');
  END IF;
  
  RETURN NEW;
END;
$$;