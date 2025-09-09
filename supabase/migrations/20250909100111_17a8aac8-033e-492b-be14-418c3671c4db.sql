-- Add position field to tournament_registrations_new table for manual sorting
ALTER TABLE tournament_registrations_new 
ADD COLUMN position INTEGER DEFAULT NULL;

-- Create index for better performance when sorting by position
CREATE INDEX idx_tournament_registrations_position 
ON tournament_registrations_new(tournament_id, position);