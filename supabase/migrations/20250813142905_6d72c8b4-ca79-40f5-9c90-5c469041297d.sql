-- Update empty matches to have "pending" status
UPDATE matches 
SET status = 'pending' 
WHERE tournament_id = 'ea2eeef2-0a36-4559-82ca-5a5901dbcd4d'
  AND status = 'scheduled'
  AND id NOT IN (
    SELECT DISTINCT match_id 
    FROM match_participants 
    WHERE player_id IS NOT NULL 
      AND match_id IN (
        SELECT id FROM matches WHERE tournament_id = 'ea2eeef2-0a36-4559-82ca-5a5901dbcd4d'
      )
  );