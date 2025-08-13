-- Update empty matches to have "pending" status for the correct tournament
UPDATE matches 
SET status = 'pending' 
WHERE tournament_id = 'b57bfcdd-2045-4f0f-8eec-98e6a2e8e58d'
  AND status = 'scheduled'
  AND id NOT IN (
    SELECT DISTINCT match_id 
    FROM match_participants 
    WHERE player_id IS NOT NULL 
      AND match_id IN (
        SELECT id FROM matches WHERE tournament_id = 'b57bfcdd-2045-4f0f-8eec-98e6a2e8e58d'
      )
  );