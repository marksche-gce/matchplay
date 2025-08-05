-- Update existing matches to use consistent round naming
-- For a 16-player tournament (8 matches in round 1, 4 in round 2, 2 in round 3, 1 in round 4)

-- Update matches currently labeled as "Quarterfinals" to "Round 2"
UPDATE matches 
SET round = 'Round 2' 
WHERE round = 'Quarterfinals';

-- Update matches currently labeled as "Semifinals" to "Round 3"
UPDATE matches 
SET round = 'Round 3' 
WHERE round = 'Semifinals';

-- Update matches currently labeled as "Final" to "Round 4"  
UPDATE matches 
SET round = 'Round 4'
WHERE round = 'Final';