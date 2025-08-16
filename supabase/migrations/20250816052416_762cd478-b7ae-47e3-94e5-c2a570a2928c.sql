-- Fix security definer view issue by recreating views with proper security
-- Drop existing problematic views
DROP VIEW IF EXISTS public.players_simple;
DROP VIEW IF EXISTS public.players_secure;

-- Recreate players_simple view without SECURITY DEFINER
-- This view provides basic player information with conditional access to sensitive data
CREATE VIEW public.players_simple AS
SELECT 
    id,
    name,
    handicap,
    created_at,
    updated_at,
    CASE
        WHEN (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role))
        THEN email
        ELSE NULL::text
    END AS email,
    CASE
        WHEN (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role))
        THEN phone
        ELSE NULL::text
    END AS phone,
    CASE
        WHEN (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role))
        THEN emergency_contact
        ELSE NULL::text
    END AS emergency_contact,
    CASE
        WHEN (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role))
        THEN user_id
        ELSE NULL::uuid
    END AS user_id
FROM public.players;

-- Recreate players_secure view without SECURITY DEFINER
-- This view provides secure access to player data with proper filtering
CREATE VIEW public.players_secure AS
SELECT 
    id,
    name,
    handicap,
    created_at,
    updated_at,
    CASE
        WHEN (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role))
        THEN email
        ELSE NULL::text
    END AS email,
    CASE
        WHEN (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role))
        THEN phone
        ELSE NULL::text
    END AS phone,
    CASE
        WHEN (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role))
        THEN emergency_contact
        ELSE NULL::text
    END AS emergency_contact,
    user_id
FROM public.players p
WHERE (
    auth.uid() = user_id 
    OR has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'organizer'::app_role)
    OR EXISTS (
        SELECT 1
        FROM tournament_registrations tr1
        JOIN tournament_registrations tr2 ON tr1.tournament_id = tr2.tournament_id
        JOIN players p2 ON tr1.player_id = p2.id
        WHERE tr2.player_id = p.id AND p2.user_id = auth.uid()
    )
);

-- Enable RLS on the views (inherits from underlying tables)
ALTER VIEW public.players_simple SET (security_invoker = true);
ALTER VIEW public.players_secure SET (security_invoker = true);

-- Grant appropriate permissions
GRANT SELECT ON public.players_simple TO authenticated;
GRANT SELECT ON public.players_secure TO authenticated;

-- Revoke unnecessary permissions
REVOKE ALL ON public.players_simple FROM anon;
REVOKE ALL ON public.players_secure FROM anon;