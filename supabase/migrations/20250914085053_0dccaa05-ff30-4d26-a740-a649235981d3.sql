-- Create edge function to get participants for embed view
CREATE OR REPLACE FUNCTION get_embed_participants(tournament_id_param uuid)
RETURNS TABLE(
  id uuid,
  name text,
  email text,
  handicap numeric,
  registered_at timestamp with time zone,
  is_team boolean,
  team_name text,
  player1_name text,
  player1_email text,
  player1_handicap numeric,
  player2_name text,
  player2_email text,
  player2_handicap numeric,
  position integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if tournament exists
  IF NOT EXISTS (SELECT 1 FROM tournaments_new WHERE tournaments_new.id = tournament_id_param) THEN
    RETURN;
  END IF;

  -- Get tournament type
  RETURN QUERY
  WITH tournament_info AS (
    SELECT t.type
    FROM tournaments_new t
    WHERE t.id = tournament_id_param
  )
  SELECT 
    CASE 
      WHEN tournament_info.type = 'singles' THEN tr.id
      ELSE tr.id
    END as id,
    CASE 
      WHEN tournament_info.type = 'singles' THEN p.name
      ELSE NULL::text
    END as name,
    CASE 
      WHEN tournament_info.type = 'singles' THEN p.email
      ELSE NULL::text
    END as email,
    CASE 
      WHEN tournament_info.type = 'singles' THEN p.handicap
      ELSE NULL::numeric
    END as handicap,
    tr.registered_at,
    CASE 
      WHEN tournament_info.type = 'foursome' THEN true
      ELSE false
    END as is_team,
    CASE 
      WHEN tournament_info.type = 'foursome' THEN teams.name
      ELSE NULL::text
    END as team_name,
    CASE 
      WHEN tournament_info.type = 'foursome' THEN p1.name
      ELSE NULL::text
    END as player1_name,
    CASE 
      WHEN tournament_info.type = 'foursome' THEN p1.email
      ELSE NULL::text
    END as player1_email,
    CASE 
      WHEN tournament_info.type = 'foursome' THEN p1.handicap
      ELSE NULL::numeric
    END as player1_handicap,
    CASE 
      WHEN tournament_info.type = 'foursome' THEN p2.name
      ELSE NULL::text
    END as player2_name,
    CASE 
      WHEN tournament_info.type = 'foursome' THEN p2.email
      ELSE NULL::text
    END as player2_email,
    CASE 
      WHEN tournament_info.type = 'foursome' THEN p2.handicap
      ELSE NULL::numeric
    END as player2_handicap,
    tr.position
  FROM tournament_registrations_new tr
  CROSS JOIN tournament_info
  LEFT JOIN players_new p ON tr.player_id = p.id AND tournament_info.type = 'singles'
  LEFT JOIN teams ON tr.team_id = teams.id AND tournament_info.type = 'foursome'
  LEFT JOIN players_new p1 ON teams.player1_id = p1.id AND tournament_info.type = 'foursome'
  LEFT JOIN players_new p2 ON teams.player2_id = p2.id AND tournament_info.type = 'foursome'
  WHERE tr.tournament_id = tournament_id_param
  ORDER BY tr.position NULLS LAST, tr.registered_at;
END;
$$;