import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tournamentId } = await req.json();
    console.log('get-embed-bracket called with tournamentId:', tournamentId);
    
    if (!tournamentId) {
      return new Response(JSON.stringify({ error: "tournamentId ist erforderlich" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch tournament info to determine type
    const { data: tournament, error: tournamentError } = await admin
      .from('tournaments_new')
      .select('id, type, max_players, name')
      .eq('id', tournamentId)
      .maybeSingle();

    if (tournamentError) {
      console.error('Error fetching tournament:', tournamentError);
    }

    // Fetch matches for the tournament
    const { data: matches, error: matchesError } = await admin
      .from('matches_new')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round_number')
      .order('match_number');

    if (matchesError) {
      console.error('Error fetching matches:', matchesError);
      return new Response(JSON.stringify({ error: matchesError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('Matches found:', matches?.length || 0);

    // Fetch registration count
    const { count, error: countError } = await admin
      .from('tournament_registrations_new')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId);

    if (countError) {
      console.error('Error fetching registration count:', countError);
      return new Response(JSON.stringify({ error: countError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('Registration count:', count);

    // Fetch round deadlines
    const { data: roundDeadlines, error: deadlinesError } = await admin
      .from('round_deadlines')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round_number');

    if (deadlinesError) {
      console.error('Error fetching round deadlines:', deadlinesError);
      return new Response(JSON.stringify({ error: deadlinesError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('Round deadlines found:', roundDeadlines?.length || 0);

    // Fetch participants ordered by position and registration date
    const { data: registrations, error: registrationsError } = await admin
      .from('tournament_registrations_new')
      .select('id, registered_at, player_id, team_id, position')
      .eq('tournament_id', tournamentId)
      .order('position', { nullsFirst: false })
      .order('registered_at');

    if (registrationsError) {
      console.error('Error fetching registrations:', registrationsError);
    }

    console.log('Registrations found:', registrations?.length || 0);

    // Enrich registrations with player/team details using batch queries
    let participantsDetailed: any[] = [];

    if (registrations && registrations.length > 0) {
      const playerIds = registrations.filter(r => r.player_id).map(r => r.player_id as string);
      const teamIds = registrations.filter(r => r.team_id).map(r => r.team_id as string);

      let playersMap: Record<string, any> = {};
      let teamsMap: Record<string, any> = {};
      let teamPlayerIds: string[] = [];

      // Fetch players for singles
      if (playerIds.length > 0) {
        const { data: players } = await admin
          .from('players_new')
          .select('id, name, email, handicap')
          .in('id', playerIds);
        (players || []).forEach(p => { playersMap[p.id] = p; });
      }

      // Fetch teams for foursome
      if (teamIds.length > 0) {
        const { data: teams } = await admin
          .from('teams')
          .select('id, name, player1_id, player2_id')
          .in('id', teamIds);
        (teams || []).forEach(t => {
          teamsMap[t.id] = t;
          if (t.player1_id) teamPlayerIds.push(t.player1_id);
          if (t.player2_id) teamPlayerIds.push(t.player2_id);
        });
      }

      // Fetch players for team members
      let teamPlayersMap: Record<string, any> = {};
      if (teamPlayerIds.length > 0) {
        const uniqueIds = Array.from(new Set(teamPlayerIds));
        const { data: teamPlayers } = await admin
          .from('players_new')
          .select('id, name, email, handicap')
          .in('id', uniqueIds);
        (teamPlayers || []).forEach(p => { teamPlayersMap[p.id] = p; });
      }

      // Build detailed participants list
      participantsDetailed = registrations.map(reg => {
        if (reg.player_id) {
          return {
            id: reg.id,
            registered_at: reg.registered_at,
            position: reg.position,
            player: playersMap[reg.player_id as string] || null,
          };
        }
        if (reg.team_id) {
          const team = teamsMap[reg.team_id as string];
          return {
            id: reg.id,
            registered_at: reg.registered_at,
            position: reg.position,
            team: team ? {
              id: team.id,
              name: team.name,
              player1: team.player1_id ? teamPlayersMap[team.player1_id] || null : null,
              player2: team.player2_id ? teamPlayersMap[team.player2_id] || null : null,
            } : null,
          };
        }
        return { id: reg.id, registered_at: reg.registered_at, position: reg.position };
      });
    }

    const result = { 
      tournament,
      matches: matches ?? [], 
      registrationCount: count ?? 0,
      roundDeadlines: roundDeadlines ?? [],
      participants: registrations ?? [],
      participantsDetailed
    };
    
    console.log('Returning result with keys:', Object.keys(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error('get-embed-bracket error:', e);
    return new Response(JSON.stringify({ error: e?.message ?? 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
