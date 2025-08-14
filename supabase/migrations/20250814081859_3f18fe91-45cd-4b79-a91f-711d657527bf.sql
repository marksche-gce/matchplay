-- Temporarily remove the restrictive check constraint that prevents empty matches
-- This will allow us to create bracket structures with empty slots
ALTER TABLE matches_new DROP CONSTRAINT IF EXISTS matches_new_check;

-- We can add it back later if needed, but for now we need to allow empty bracket generation