import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ClearMatchParticipantsRequest {
  tournamentId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the tournament ID from the request
    const { tournamentId }: ClearMatchParticipantsRequest = await req.json();

    if (!tournamentId) {
      return new Response(
        JSON.stringify({ error: 'Tournament ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Starting to clear match participants for tournament: ${tournamentId}`);

    // Get all matches for this tournament
    const { data: matches, error: matchesError } = await supabase
      .from('matches_new')
      .select('id')
      .eq('tournament_id', tournamentId);

    if (matchesError) {
      console.error('Error fetching matches:', matchesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch matches' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Found ${matches?.length || 0} matches for tournament ${tournamentId}`);

    if (matches && matches.length > 0) {
      const matchIds = matches.map(match => match.id);

      // Delete all match participants for these matches
      const { error: deleteParticipantsError } = await supabase
        .from('match_participants')
        .delete()
        .in('match_id', matchIds);

      if (deleteParticipantsError) {
        console.error('Error deleting match participants:', deleteParticipantsError);
        return new Response(
          JSON.stringify({ error: 'Failed to delete match participants' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Reset match fields to clear player assignments
      const { error: updateMatchesError } = await supabase
        .from('matches_new')
        .update({
          player1_id: null,
          player2_id: null,
          team1_id: null,
          team2_id: null,
          winner_player_id: null,
          winner_team_id: null,
          status: 'pending'
        })
        .eq('tournament_id', tournamentId);

      if (updateMatchesError) {
        console.error('Error updating matches:', updateMatchesError);
        return new Response(
          JSON.stringify({ error: 'Failed to reset matches' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log(`Successfully cleared all match participants and reset matches for tournament ${tournamentId}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'All match participants cleared successfully',
        matchesCleared: matches?.length || 0
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in clear-match-participants function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});