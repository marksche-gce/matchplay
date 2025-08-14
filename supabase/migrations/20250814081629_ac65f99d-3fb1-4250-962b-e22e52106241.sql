-- Update the max_rounds calculation to be correct
-- 8 players = 2 rounds, 16 players = 3 rounds, etc.
ALTER TABLE tournaments_new 
DROP CONSTRAINT IF EXISTS tournaments_new_max_rounds_check;

-- Drop the existing generated column
ALTER TABLE tournaments_new 
DROP COLUMN IF EXISTS max_rounds;

-- Add max_rounds as a regular column with correct calculation
ALTER TABLE tournaments_new 
ADD COLUMN max_rounds INTEGER GENERATED ALWAYS AS (
  CASE 
    WHEN max_players <= 1 THEN 0
    ELSE CEIL(LOG(2, max_players)) - 1
  END
) STORED;