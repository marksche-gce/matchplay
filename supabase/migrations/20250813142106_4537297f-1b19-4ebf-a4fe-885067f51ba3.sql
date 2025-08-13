-- Add missing DELETE policy for match_participants table
CREATE POLICY "Organizers can delete match participants" 
ON match_participants 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'organizer'::app_role));