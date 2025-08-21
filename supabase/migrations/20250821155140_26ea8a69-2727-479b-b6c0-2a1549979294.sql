-- Fix RLS so round deadlines can be managed by system admins and tenant organizers
-- Ensure RLS is enabled
ALTER TABLE public.round_deadlines ENABLE ROW LEVEL SECURITY;

-- Drop incorrect/broken policy if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'round_deadlines' 
      AND policyname = 'Organizers can manage deadlines'
  ) THEN
    DROP POLICY "Organizers can manage deadlines" ON public.round_deadlines;
  END IF;
END $$;

-- Allow system admins to manage deadlines
CREATE POLICY "System admins can manage deadlines"
ON public.round_deadlines
FOR ALL
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- Allow tenant organizers to manage deadlines by joining tournaments_new to check tenant
CREATE POLICY "Tenant organizers can manage deadlines"
ON public.round_deadlines
FOR ALL
USING (
  EXISTS (
    SELECT 1 
    FROM public.tournaments_new t
    WHERE t.id = round_deadlines.tournament_id
      AND is_tenant_organizer(auth.uid(), t.tenant_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.tournaments_new t
    WHERE t.id = round_deadlines.tournament_id
      AND is_tenant_organizer(auth.uid(), t.tenant_id)
  )
);
