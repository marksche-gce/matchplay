-- Allow null player_id in match_participants for "no opponent" scenarios
ALTER TABLE public.match_participants 
ALTER COLUMN player_id DROP NOT NULL;

-- Add a check constraint to ensure either player_id is provided OR it's a valid placeholder
ALTER TABLE public.match_participants 
ADD CONSTRAINT valid_participant_check 
CHECK (
  player_id IS NOT NULL OR 
  (player_id IS NULL AND position IS NOT NULL)
);