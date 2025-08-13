-- Create Round 2 matches for the current tournament
INSERT INTO matches (tournament_id, type, round, status, match_date, match_time, tee, previous_match_1_id, previous_match_2_id)
SELECT 
  'ea2eeef2-0a36-4559-82ca-5a5901dbcd4d',
  'singles',
  'Semifinals',
  'scheduled',
  CURRENT_DATE,
  '09:00:00',
  1,
  (SELECT id FROM matches WHERE tournament_id = 'ea2eeef2-0a36-4559-82ca-5a5901dbcd4d' AND round = 'Round 1' ORDER BY created_at LIMIT 1),
  (SELECT id FROM matches WHERE tournament_id = 'ea2eeef2-0a36-4559-82ca-5a5901dbcd4d' AND round = 'Round 1' ORDER BY created_at LIMIT 1 OFFSET 1);