-- Fix RLS to allow bracket match creation for tenant organizers
-- Remove outdated organizer policy on matches_new
DROP POLICY IF EXISTS "Organizers can manage matches" ON public.matches_new;

-- Allow tenant organizers and tenant admins to manage matches for tournaments in their tenant
CREATE POLICY "Tenant organizers can manage matches"
ON public.matches_new
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.tournaments_new t
    WHERE t.id = matches_new.tournament_id
      AND is_tenant_organizer(auth.uid(), t.tenant_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tournaments_new t
    WHERE t.id = matches_new.tournament_id
      AND is_tenant_organizer(auth.uid(), t.tenant_id)
  )
);

-- System admins can manage all matches
CREATE POLICY "System admins can manage matches"
ON public.matches_new
FOR ALL
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));