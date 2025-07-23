-- Fix duplicate matches by completely clearing and rebuilding from Round 1 winners
DELETE FROM match_participants 
WHERE match_id IN (
  SELECT id FROM matches 
  WHERE tournament_id = 'e9cd106e-6a3d-4391-9c44-6091ba2b252d'
);

DELETE FROM matches 
WHERE tournament_id = 'e9cd106e-6a3d-4391-9c44-6091ba2b252d';

-- Recreate Round 1 matches with proper structure
INSERT INTO matches (tournament_id, round, type, status) VALUES
('e9cd106e-6a3d-4391-9c44-6091ba2b252d', 'Round 1', 'singles', 'completed'),
('e9cd106e-6a3d-4391-9c44-6091ba2b252d', 'Round 1', 'singles', 'completed'),
('e9cd106e-6a3d-4391-9c44-6091ba2b252d', 'Round 1', 'singles', 'completed'),
('e9cd106e-6a3d-4391-9c44-6091ba2b252d', 'Round 1', 'singles', 'completed');

-- Get the newly created match IDs for Round 1
WITH round1_matches AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as match_num
  FROM matches 
  WHERE tournament_id = 'e9cd106e-6a3d-4391-9c44-6091ba2b252d' 
  AND round = 'Round 1'
),
player_lookup AS (
  SELECT id, name FROM players WHERE id IN (
    'bb04ac34-8cda-49c0-9705-b6e84b8bb10e', -- Markus Andermatt
    '00b65d7c-1e7e-4f25-b4d3-1c7f3a9c8e2b', -- Rosmarie Aregger  
    '7a8f9b6c-2d3e-4a5b-8c9d-1e2f3a4b5c6d', -- Thomas Mueller
    'd4e5f6a7-8b9c-1d2e-3f4a-5b6c7d8e9f0a', -- Sarah Weber
    'c3d4e5f6-7a8b-9c1d-2e3f-4a5b6c7d8e9f', -- Andreas Zimmermann
    'b2c3d4e5-6f7a-8b9c-1d2e-3f4a5b6c7d8e', -- Petra Marti
    'a1b2c3d4-5e6f-7a8b-9c1d-2e3f4a5b6c7d', -- Michael Brunner
    '9f0a1b2c-3d4e-5f6a-7b8c-9d1e2f3a4b5c'  -- Elena Fischer
  )
)
INSERT INTO match_participants (match_id, player_id, position)
SELECT 
  r1.id,
  CASE 
    WHEN r1.match_num = 1 AND mp.pos = 1 THEN 'bb04ac34-8cda-49c0-9705-b6e84b8bb10e' -- Markus
    WHEN r1.match_num = 1 AND mp.pos = 2 THEN '00b65d7c-1e7e-4f25-b4d3-1c7f3a9c8e2b' -- Rosmarie
    WHEN r1.match_num = 2 AND mp.pos = 1 THEN '7a8f9b6c-2d3e-4a5b-8c9d-1e2f3a4b5c6d' -- Thomas
    WHEN r1.match_num = 2 AND mp.pos = 2 THEN 'd4e5f6a7-8b9c-1d2e-3f4a-5b6c7d8e9f0a' -- Sarah
    WHEN r1.match_num = 3 AND mp.pos = 1 THEN 'c3d4e5f6-7a8b-9c1d-2e3f-4a5b6c7d8e9f' -- Andreas
    WHEN r1.match_num = 3 AND mp.pos = 2 THEN 'b2c3d4e5-6f7a-8b9c-1d2e-3f4a5b6c7d8e' -- Petra
    WHEN r1.match_num = 4 AND mp.pos = 1 THEN 'a1b2c3d4-5e6f-7a8b-9c1d-2e3f4a5b6c7d' -- Michael
    WHEN r1.match_num = 4 AND mp.pos = 2 THEN '9f0a1b2c-3d4e-5f6a-7b8c-9d1e2f3a4b5c' -- Elena
  END,
  mp.pos
FROM round1_matches r1
CROSS JOIN (VALUES (1), (2)) AS mp(pos);

-- Set winners for Round 1 matches
UPDATE matches SET winner_id = 'bb04ac34-8cda-49c0-9705-b6e84b8bb10e' WHERE id = (SELECT id FROM matches WHERE tournament_id = 'e9cd106e-6a3d-4391-9c44-6091ba2b252d' AND round = 'Round 1' ORDER BY created_at LIMIT 1);
UPDATE matches SET winner_id = '7a8f9b6c-2d3e-4a5b-8c9d-1e2f3a4b5c6d' WHERE id = (SELECT id FROM matches WHERE tournament_id = 'e9cd106e-6a3d-4391-9c44-6091ba2b252d' AND round = 'Round 1' ORDER BY created_at LIMIT 1 OFFSET 1);
UPDATE matches SET winner_id = 'c3d4e5f6-7a8b-9c1d-2e3f-4a5b6c7d8e9f' WHERE id = (SELECT id FROM matches WHERE tournament_id = 'e9cd106e-6a3d-4391-9c44-6091ba2b252d' AND round = 'Round 1' ORDER BY created_at LIMIT 1 OFFSET 2);
UPDATE matches SET winner_id = 'a1b2c3d4-5e6f-7a8b-9c1d-2e3f4a5b6c7d' WHERE id = (SELECT id FROM matches WHERE tournament_id = 'e9cd106e-6a3d-4391-9c44-6091ba2b252d' AND round = 'Round 1' ORDER BY created_at LIMIT 1 OFFSET 3);