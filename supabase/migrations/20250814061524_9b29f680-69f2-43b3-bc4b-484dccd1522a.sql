-- Clean slate: Create match play tournament system

-- First, create enums for better type safety
CREATE TYPE tournament_type AS ENUM ('singles', 'foursome');
CREATE TYPE match_status AS ENUM ('pending', 'scheduled', 'completed');
CREATE TYPE registration_status AS ENUM ('open', 'closed', 'full');

-- Tournament table with specific match play requirements
CREATE TABLE IF NOT EXISTS tournaments_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type tournament_type NOT NULL,
  max_players INTEGER NOT NULL CHECK (max_players IN (8, 16, 32, 64, 128)),
  max_rounds INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN max_players = 8 THEN 3
      WHEN max_players = 16 THEN 4
      WHEN max_players = 32 THEN 5
      WHEN max_players = 64 THEN 6
      WHEN max_players = 128 THEN 7
    END
  ) STORED,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  registration_status registration_status DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players table - simplified for match play
CREATE TABLE IF NOT EXISTS players_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  handicap DECIMAL(4,1) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams table for foursome tournaments
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments_new(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  player1_id UUID REFERENCES players_new(id),
  player2_id UUID REFERENCES players_new(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, player1_id),
  UNIQUE(tournament_id, player2_id)
);

-- Tournament registrations
CREATE TABLE IF NOT EXISTS tournament_registrations_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments_new(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players_new(id),
  team_id UUID REFERENCES teams(id),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, player_id),
  UNIQUE(tournament_id, team_id),
  CHECK ((player_id IS NOT NULL AND team_id IS NULL) OR (player_id IS NULL AND team_id IS NOT NULL))
);

-- Round closing dates
CREATE TABLE IF NOT EXISTS round_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments_new(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  closing_date TIMESTAMPTZ NOT NULL,
  UNIQUE(tournament_id, round_number)
);

-- Matches table - core of the bracket system
CREATE TABLE IF NOT EXISTS matches_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments_new(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  match_number INTEGER NOT NULL, -- Position within the round
  status match_status DEFAULT 'pending',
  
  -- For singles matches
  player1_id UUID REFERENCES players_new(id),
  player2_id UUID REFERENCES players_new(id),
  
  -- For foursome matches  
  team1_id UUID REFERENCES teams(id),
  team2_id UUID REFERENCES teams(id),
  
  -- Winner tracking
  winner_player_id UUID REFERENCES players_new(id),
  winner_team_id UUID REFERENCES teams(id),
  
  -- Bracket progression
  feeds_to_match_id UUID REFERENCES matches_new(id),
  feeds_to_position INTEGER CHECK (feeds_to_position IN (1, 2)),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tournament_id, round_number, match_number),
  CHECK ((player1_id IS NOT NULL AND team1_id IS NULL) OR (player1_id IS NULL AND team1_id IS NOT NULL)),
  CHECK ((winner_player_id IS NOT NULL AND winner_team_id IS NULL) OR (winner_player_id IS NULL AND winner_team_id IS NULL) OR (winner_team_id IS NOT NULL AND winner_player_id IS NULL))
);

-- Enable RLS on all tables
ALTER TABLE tournaments_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE players_new ENABLE ROW LEVEL SECURITY; 
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE round_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches_new ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Public read, admin write
CREATE POLICY "Anyone can view tournaments" ON tournaments_new FOR SELECT USING (true);
CREATE POLICY "Anyone can view players" ON players_new FOR SELECT USING (true);
CREATE POLICY "Anyone can view teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Anyone can view registrations" ON tournament_registrations_new FOR SELECT USING (true);
CREATE POLICY "Anyone can view round deadlines" ON round_deadlines FOR SELECT USING (true);
CREATE POLICY "Anyone can view matches" ON matches_new FOR SELECT USING (true);

-- Write policies for public registration
CREATE POLICY "Anyone can register as player" ON players_new FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can register for tournament" ON tournament_registrations_new FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can create teams" ON teams FOR INSERT WITH CHECK (true);

-- Allow anyone to update match winners (as per requirement)
CREATE POLICY "Anyone can update match winners" ON matches_new FOR UPDATE USING (true);

-- Admin policies (if organizer role exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    -- Organizer policies
    EXECUTE 'CREATE POLICY "Organizers can manage tournaments" ON tournaments_new FOR ALL USING (has_role(auth.uid(), ''organizer''::app_role))';
    EXECUTE 'CREATE POLICY "Organizers can manage players" ON players_new FOR ALL USING (has_role(auth.uid(), ''organizer''::app_role))';
    EXECUTE 'CREATE POLICY "Organizers can manage teams" ON teams FOR ALL USING (has_role(auth.uid(), ''organizer''::app_role))';
    EXECUTE 'CREATE POLICY "Organizers can manage registrations" ON tournament_registrations_new FOR ALL USING (has_role(auth.uid(), ''organizer''::app_role))';
    EXECUTE 'CREATE POLICY "Organizers can manage deadlines" ON round_deadlines FOR ALL USING (has_role(auth.uid(), ''organizer''::app_role))';
    EXECUTE 'CREATE POLICY "Organizers can manage matches" ON matches_new FOR ALL USING (has_role(auth.uid(), ''organizer''::app_role))';
  END IF;
END $$;