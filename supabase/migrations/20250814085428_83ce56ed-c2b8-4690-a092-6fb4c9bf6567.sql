-- Fix max_rounds calculation by updating the generated column definition
-- Drop the existing generated column and recreate it with correct formula

ALTER TABLE tournaments_new 
DROP COLUMN max_rounds;

-- Add the corrected max_rounds column as a generated column
ALTER TABLE tournaments_new 
ADD COLUMN max_rounds integer GENERATED ALWAYS AS (
  CASE 
    WHEN max_players = 8 THEN 3
    WHEN max_players = 16 THEN 4  
    WHEN max_players = 32 THEN 5
    WHEN max_players = 64 THEN 6
    WHEN max_players = 128 THEN 7
    ELSE CEIL(LOG(2, max_players))
  END
) STORED;