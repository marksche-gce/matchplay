-- Fix max_rounds calculation for existing tournaments
-- Update any tournaments that have incorrect max_rounds values

UPDATE tournaments_new 
SET max_rounds = CASE 
  WHEN max_players = 8 THEN 3
  WHEN max_players = 16 THEN 4
  WHEN max_players = 32 THEN 5
  WHEN max_players = 64 THEN 6
  WHEN max_players = 128 THEN 7
  ELSE CEIL(LOG(2, max_players))
END
WHERE max_rounds != CASE 
  WHEN max_players = 8 THEN 3
  WHEN max_players = 16 THEN 4
  WHEN max_players = 32 THEN 5
  WHEN max_players = 64 THEN 6
  WHEN max_players = 128 THEN 7
  ELSE CEIL(LOG(2, max_players))
END;