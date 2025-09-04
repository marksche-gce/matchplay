-- Fix RLS so tenant admins/organizers/managers can edit players
-- Drop broken policy relying on has_role('organizer') which always returns false
DROP POLICY IF EXISTS "Organizers can manage players" ON public.players_new;

-- Allow system admins or tenant roles (tenant_admin/organizer/manager) to update players
-- if the player is registered in a tournament that belongs to their tenant
CREATE POLICY "Tenant organizers can update players registered in their tournaments"
ON public.players_new
FOR UPDATE
USING (
  is_system_admin(auth.uid()) OR EXISTS (
    SELECT 1
    FROM public.tournament_registrations_new tr
    JOIN public.tournaments_new t ON t.id = tr.tournament_id
    JOIN public.user_roles ur ON ur.tenant_id = t.tenant_id AND ur.user_id = auth.uid()
    WHERE tr.player_id = players_new.id
      AND ur.role IN ('tenant_admin','organizer','manager')
  )
)
WITH CHECK (
  is_system_admin(auth.uid()) OR EXISTS (
    SELECT 1
    FROM public.tournament_registrations_new tr
    JOIN public.tournaments_new t ON t.id = tr.tournament_id
    JOIN public.user_roles ur ON ur.tenant_id = t.tenant_id AND ur.user_id = auth.uid()
    WHERE tr.player_id = players_new.id
      AND ur.role IN ('tenant_admin','organizer','manager')
  )
);
