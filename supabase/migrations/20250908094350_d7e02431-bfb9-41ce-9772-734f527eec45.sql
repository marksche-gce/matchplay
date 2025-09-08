-- Add missing DELETE policies for registration management
-- Allow deletion of tournament registrations by tenant organizers
CREATE POLICY "Tenant organizers can delete tournament registrations"
ON public.tournament_registrations_new
FOR DELETE
USING (
  is_system_admin(auth.uid()) OR EXISTS (
    SELECT 1
    FROM public.tournaments_new t
    JOIN public.user_roles ur ON ur.tenant_id = t.tenant_id AND ur.user_id = auth.uid()
    WHERE t.id = tournament_registrations_new.tournament_id
      AND ur.role IN ('tenant_admin','organizer','manager')
  )
);

-- Allow deletion of teams by tenant organizers
CREATE POLICY "Tenant organizers can delete teams"
ON public.teams
FOR DELETE
USING (
  is_system_admin(auth.uid()) OR EXISTS (
    SELECT 1
    FROM public.tournaments_new t
    JOIN public.user_roles ur ON ur.tenant_id = t.tenant_id AND ur.user_id = auth.uid()
    WHERE t.id = teams.tournament_id
      AND ur.role IN ('tenant_admin','organizer','manager')
  )
);

-- Allow deletion of players by tenant organizers (when they are registered in tournaments)
CREATE POLICY "Tenant organizers can delete players"
ON public.players_new
FOR DELETE
USING (
  is_system_admin(auth.uid()) OR EXISTS (
    SELECT 1
    FROM public.tournament_registrations_new tr
    JOIN public.tournaments_new t ON t.id = tr.tournament_id
    JOIN public.user_roles ur ON ur.tenant_id = t.tenant_id AND ur.user_id = auth.uid()
    WHERE tr.player_id = players_new.id
      AND ur.role IN ('tenant_admin','organizer','manager')
  )
);