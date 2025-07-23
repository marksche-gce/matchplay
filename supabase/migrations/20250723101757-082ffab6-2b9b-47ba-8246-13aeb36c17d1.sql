-- Delete all matches except Round 1 to regenerate correct bracket structure
DELETE FROM matches 
WHERE tournament_id = 'e9cd106e-6a3d-4391-9c44-6091ba2b252d' 
AND round != 'Round 1';

-- Also delete any match participants for non-Round 1 matches
DELETE FROM match_participants 
WHERE match_id IN (
  SELECT id FROM matches 
  WHERE tournament_id = 'e9cd106e-6a3d-4391-9c44-6091ba2b252d' 
  AND round != 'Round 1'
);

-- Reset next_match_id for Round 1 matches since the next matches will be recreated
UPDATE matches 
SET next_match_id = NULL 
WHERE tournament_id = 'e9cd106e-6a3d-4391-9c44-6091ba2b252d' 
AND round = 'Round 1';