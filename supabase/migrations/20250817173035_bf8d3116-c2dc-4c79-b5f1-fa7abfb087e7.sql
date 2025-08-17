-- Add tenant_id to tournaments_new table
ALTER TABLE public.tournaments_new 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- Update existing tournaments to have a default tenant_id (if any exist)
-- We'll use the first available tenant as default for existing records
UPDATE public.tournaments_new 
SET tenant_id = (SELECT id FROM public.tenants LIMIT 1)
WHERE tenant_id IS NULL;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Anyone can view tournaments" ON public.tournaments_new;
DROP POLICY IF EXISTS "Organizers can manage tournaments" ON public.tournaments_new;

-- Create new RLS policies using tenant-based roles
CREATE POLICY "Users can view tournaments in their tenant" 
ON public.tournaments_new 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND tenant_id = tournaments_new.tenant_id
  )
);

CREATE POLICY "Tenant organizers can manage tournaments" 
ON public.tournaments_new 
FOR ALL 
USING (is_tenant_organizer(auth.uid(), tenant_id))
WITH CHECK (is_tenant_organizer(auth.uid(), tenant_id));

-- System admins can view all tournaments
CREATE POLICY "System admins can view all tournaments" 
ON public.tournaments_new 
FOR SELECT 
USING (is_system_admin(auth.uid()));