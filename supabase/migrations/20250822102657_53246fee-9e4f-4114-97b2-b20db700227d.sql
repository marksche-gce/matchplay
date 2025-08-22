-- Ensure system admins can always manage deadlines (external host fallback)
CREATE POLICY "System admins manage deadlines (external)"
ON public.round_deadlines
FOR ALL
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- Allow tenant admins/managers/organizers via legacy tournaments table (INSERT)
CREATE POLICY "Tenant admins/managers can insert deadlines (legacy tournaments)"
ON public.round_deadlines
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tournaments t
    JOIN public.user_roles ur
      ON ur.tenant_id = t.tenant_id
     AND ur.user_id = auth.uid()
    WHERE t.id = round_deadlines.tournament_id
      AND ur.role IN ('tenant_admin','manager','organizer')
  )
);

-- UPDATE via legacy tournaments
CREATE POLICY "Tenant admins/managers can update deadlines (legacy tournaments)"
ON public.round_deadlines
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tournaments t
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
    FROM public.tournaments t
    JOIN public.user_roles ur
      ON ur.tenant_id = t.tenant_id
     AND ur.user_id = auth.uid()
    WHERE t.id = round_deadlines.tournament_id
      AND ur.role IN ('tenant_admin','manager','organizer')
  )
);

-- DELETE via legacy tournaments
CREATE POLICY "Tenant admins/managers can delete deadlines (legacy tournaments)"
ON public.round_deadlines
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tournaments t
    JOIN public.user_roles ur
      ON ur.tenant_id = t.tenant_id
     AND ur.user_id = auth.uid()
    WHERE t.id = round_deadlines.tournament_id
      AND ur.role IN ('tenant_admin','manager','organizer')
  )
);