-- Update existing matches to use consistent round naming for tournament 070bceb6-9cfa-4d4a-9250-035466d06c7b

-- Update matches currently labeled as "Quarterfinals" to "Round 2"
UPDATE matches 
SET round = 'Round 2' 
WHERE round = 'Quarterfinals' AND tournament_id = '070bceb6-9cfa-4d4a-9250-035466d06c7b';

-- Update matches currently labeled as "Semifinals" to "Round 3"
UPDATE matches 
SET round = 'Round 3' 
WHERE round = 'Semifinals' AND tournament_id = '070bceb6-9cfa-4d4a-9250-035466d06c7b';

-- Update matches currently labeled as "Final" to "Round 4"  
UPDATE matches 
SET round = 'Round 4'
WHERE round = 'Final' AND tournament_id = '070bceb6-9cfa-4d4a-9250-035466d06c7b';