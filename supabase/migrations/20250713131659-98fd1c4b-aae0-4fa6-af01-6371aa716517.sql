-- Add DELETE policy for tournaments
CREATE POLICY "Admins and organizers can delete tournaments" 
ON public.tournaments 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role));