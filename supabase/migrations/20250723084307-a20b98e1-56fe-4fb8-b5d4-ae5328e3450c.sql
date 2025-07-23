-- Drop the problematic unique constraint that doesn't work with NULL player_ids
ALTER TABLE public.match_participants 
DROP CONSTRAINT IF EXISTS match_participants_match_id_player_id_key;

-- Create a new unique constraint that handles both real players and placeholders properly
-- For real players: ensure unique match_id + player_id
-- For placeholders: ensure unique match_id + position when player_id is NULL
CREATE UNIQUE INDEX unique_match_participant_real_player 
ON public.match_participants (match_id, player_id) 
WHERE player_id IS NOT NULL;

CREATE UNIQUE INDEX unique_match_participant_placeholder 
ON public.match_participants (match_id, position) 
WHERE player_id IS NULL AND is_placeholder = TRUE;