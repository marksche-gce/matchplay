-- Allow tenant organizers to update tournament registrations (for saving manual order)
CREATE POLICY "Tenant organizers can update tournament registrations"
ON tournament_registrations_new
FOR UPDATE
USING (
  is_system_admin(auth.uid()) OR EXISTS (
    SELECT 1
    FROM tournaments_new t
    JOIN user_roles ur ON ur.tenant_id = t.tenant_id AND ur.user_id = auth.uid()
    WHERE t.id = tournament_registrations_new.tournament_id
      AND ur.role = ANY (ARRAY['tenant_admin'::tenant_role, 'organizer'::tenant_role, 'manager'::tenant_role])
  )
)
WITH CHECK (
  is_system_admin(auth.uid()) OR EXISTS (
    SELECT 1
    FROM tournaments_new t
    JOIN user_roles ur ON ur.tenant_id = t.tenant_id AND ur.user_id = auth.uid()
    WHERE t.id = tournament_registrations_new.tournament_id
      AND ur.role = ANY (ARRAY['tenant_admin'::tenant_role, 'organizer'::tenant_role, 'manager'::tenant_role])
  )
);