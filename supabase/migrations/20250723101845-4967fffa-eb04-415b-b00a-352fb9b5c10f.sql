-- Clear all relationships first
UPDATE matches 
SET next_match_id = NULL, 
    previous_match_1_id = NULL, 
    previous_match_2_id = NULL
WHERE tournament_id = 'e9cd106e-6a3d-4391-9c44-6091ba2b252d';

-- Delete all matches except Round 1
DELETE FROM matches 
WHERE tournament_id = 'e9cd106e-6a3d-4391-9c44-6091ba2b252d' 
AND round != 'Round 1';