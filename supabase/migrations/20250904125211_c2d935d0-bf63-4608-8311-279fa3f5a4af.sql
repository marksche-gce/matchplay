-- Secure players_new: remove unintended public and broad select policies
DROP POLICY IF EXISTS "Public can view basic player info" ON public.players_new;
DROP POLICY IF EXISTS "Users can view players in shared tournaments" ON public.players_new;