-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own registrations" ON public.tournament_registrations;
DROP POLICY IF EXISTS "Authenticated users can register for tournaments" ON public.tournament_registrations;
DROP POLICY IF EXISTS "Users can update their own registrations" ON public.tournament_registrations;

-- Create a secure function to check if user owns a player record
CREATE OR REPLACE FUNCTION public.user_owns_player(player_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players 
    WHERE id = player_id_param AND user_id = auth.uid()
  );
$$;

-- Create new policies without recursion
CREATE POLICY "Users can view registrations for their players"
ON public.tournament_registrations
FOR SELECT
USING (
  public.user_owns_player(player_id) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'organizer'::app_role)
);

CREATE POLICY "Users can register their players"
ON public.tournament_registrations
FOR INSERT
WITH CHECK (public.user_owns_player(player_id));

CREATE POLICY "Users can update their player registrations"
ON public.tournament_registrations
FOR UPDATE
USING (public.user_owns_player(player_id));