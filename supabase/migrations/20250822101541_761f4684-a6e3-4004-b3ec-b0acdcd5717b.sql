-- Allow tenant_admins and managers (and organizers) to manage round deadlines
-- without weakening public read access.

-- INSERT policy
CREATE POLICY "Tenant admins and managers can insert deadlines"
ON public.round_deadlines
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tournaments_new t
    JOIN public.user_roles ur
      ON ur.tenant_id = t.tenant_id
     AND ur.user_id = auth.uid()
    WHERE t.id = round_deadlines.tournament_id
      AND ur.role IN ('tenant_admin','manager','organizer')
  )
);

-- UPDATE policy
CREATE POLICY "Tenant admins and managers can update deadlines"
ON public.round_deadlines
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tournaments_new t
    JOIN public.user_roles ur
      ON ur.tenant_id = t.tenant_id
     AND ur.user_id = auth.uid()
    WHERE t.id = round_deadlines.tournament_id
      AND ur.role IN ('tenant_admin','manager','organizer')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tournaments_new t
    JOIN public.user_roles ur
      ON ur.tenant_id = t.tenant_id
     AND ur.user_id = auth.uid()
    WHERE t.id = round_deadlines.tournament_id
      AND ur.role IN ('tenant_admin','manager','organizer')
  )
);

-- DELETE policy
CREATE POLICY "Tenant admins and managers can delete deadlines"
ON public.round_deadlines
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tournaments_new t
    JOIN public.user_roles ur
      ON ur.tenant_id = t.tenant_id
     AND ur.user_id = auth.uid()
    WHERE t.id = round_deadlines.tournament_id
      AND ur.role IN ('tenant_admin','manager','organizer')
  )
);