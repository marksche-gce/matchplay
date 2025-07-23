-- Add a column to track placeholder participants (no opponents)
ALTER TABLE public.match_participants 
ADD COLUMN is_placeholder BOOLEAN DEFAULT FALSE;

-- Add a column to store placeholder identifier for "no opponent" entries
ALTER TABLE public.match_participants 
ADD COLUMN placeholder_name TEXT DEFAULT NULL;

-- Drop the existing constraint
ALTER TABLE public.match_participants 
DROP CONSTRAINT IF EXISTS valid_participant_check;

-- Add the new constraint
ALTER TABLE public.match_participants 
ADD CONSTRAINT valid_participant_check 
CHECK (
  (player_id IS NOT NULL AND is_placeholder = FALSE) OR 
  (player_id IS NULL AND is_placeholder = TRUE AND placeholder_name IS NOT NULL)
);