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

    // Fetch participants ordered by position
    const { data: participants, error: participantsError } = await admin
      .from('tournament_registrations_new')
      .select(`
        id,
        registered_at,
        player_id,
        team_id,
        position
      `)
      .eq('tournament_id', tournamentId)
      .order('position', { nullsFirst: false })
      .order('registered_at');

    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
    }

    console.log('Participants found:', participants?.length || 0);

    const result = { 
      matches: matches ?? [], 
      registrationCount: count ?? 0,
      roundDeadlines: roundDeadlines ?? [],
      participants: participants ?? []
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
