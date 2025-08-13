-- Fix the winner_id for the completed matches based on the participants
-- Match 1: Mitul Aggarwal should be the winner
UPDATE matches 
SET winner_id = '1404fd6e-d6c9-4ccd-bf83-649a27704fe4'
WHERE id = '3bd5ebdb-627c-40b0-95a6-b5459a57ad6e';

-- Match 2: Pamela Annaki should be the winner  
UPDATE matches 
SET winner_id = 'b40c7a7f-a81f-4d09-ba7b-52dc4baa9be1'
WHERE id = '19e4957e-faa1-4d3f-9bf5-99a0148cf522';

-- Create Round 2 matches for winner advancement
-- These should be created automatically by the system, but let's create them manually
INSERT INTO matches (tournament_id, type, round, status, previous_match_1_id, previous_match_2_id)
VALUES 
  ('2e462f4f-3fcc-47d7-94a7-35f43453c775', 'singles', 'Quarterfinals', 'pending', '3bd5ebdb-627c-40b0-95a6-b5459a57ad6e', '19e4957e-faa1-4d3f-9bf5-99a0148cf522');

-- Add the winners as participants in the Round 2 match
INSERT INTO match_participants (match_id, player_id, position) 
SELECT 
  m.id as match_id,
  '1404fd6e-d6c9-4ccd-bf83-649a27704fe4' as player_id,
  1 as position
FROM matches m 
WHERE m.tournament_id = '2e462f4f-3fcc-47d7-94a7-35f43453c775' 
  AND m.round = 'Quarterfinals' 
  AND m.previous_match_1_id = '3bd5ebdb-627c-40b0-95a6-b5459a57ad6e';

INSERT INTO match_participants (match_id, player_id, position)
SELECT 
  m.id as match_id,
  'b40c7a7f-a81f-4d09-ba7b-52dc4baa9be1' as player_id,
  2 as position
FROM matches m 
WHERE m.tournament_id = '2e462f4f-3fcc-47d7-94a7-35f43453c775' 
  AND m.round = 'Quarterfinals' 
  AND m.previous_match_2_id = '19e4957e-faa1-4d3f-9bf5-99a0148cf522';