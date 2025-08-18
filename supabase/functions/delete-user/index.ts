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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";

    // Client bound to the caller's JWT
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service role client for admin operations
    const adminClient = createClient(supabaseUrl, serviceKey);

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check system admin via system_roles
    const { data: sysRole, error: sysErr } = await adminClient
      .from("system_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "system_admin")
      .maybeSingle();

    if (sysErr) {
      console.error("System role check error:", sysErr);
      return new Response(JSON.stringify({ error: sysErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!sysRole) {
      return new Response(JSON.stringify({ error: "Nur Systemadministratoren können Benutzer löschen" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the user ID to delete from request
    const { userId } = await req.json();
    
    if (!userId) {
      return new Response(JSON.stringify({ error: "Benutzer-ID ist erforderlich" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-deletion
    if (userId === user.id) {
      return new Response(JSON.stringify({ error: "Sie können sich nicht selbst löschen" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // First, find player IDs linked to this user
    const { data: playersOfUser, error: playersErr } = await adminClient
      .from("players")
      .select("id")
      .eq("user_id", userId);

    if (playersErr) {
      console.error("Fetch players error:", playersErr);
    }

    const playerIds = (playersOfUser || []).map((p: any) => p.id);

    if (playerIds.length > 0) {
      // Clear references in legacy matches table
      const { error: clearMatchesError } = await adminClient
        .from("matches")
        .update({ winner_id: null })
        .in("winner_id", playerIds);
      if (clearMatchesError) console.error("Clear matches error:", clearMatchesError);

      // Clear references in new matches table
      const { error: clearMatchesNewPlayerError } = await adminClient
        .from("matches_new")
        .update({ winner_player_id: null })
        .in("winner_player_id", playerIds);
      if (clearMatchesNewPlayerError) console.error("Clear matches_new player error:", clearMatchesNewPlayerError);

      // Collect team IDs involving these players
      const { data: teamsInvolving, error: teamsFetchErr } = await adminClient
        .from("teams")
        .select("id, player1_id, player2_id")
        .or(`player1_id.in.(${playerIds.join(',')}),player2_id.in.(${playerIds.join(',')})`);
      if (teamsFetchErr) console.error("Fetch teams error:", teamsFetchErr);
      const teamIds = (teamsInvolving || []).map((t: any) => t.id);

      // Clear winner_team_id in matches_new that reference these teams
      if (teamIds.length > 0) {
        const { error: clearMatchesNewTeamError } = await adminClient
          .from("matches_new")
          .update({ winner_team_id: null })
          .in("winner_team_id", teamIds);
        if (clearMatchesNewTeamError) console.error("Clear matches_new team error:", clearMatchesNewTeamError);
      }

      // Remove player from teams
      const { error: clearTeamsP1 } = await adminClient
        .from("teams")
        .update({ player1_id: null })
        .in("player1_id", playerIds);
      if (clearTeamsP1) console.error("Clear teams player1 error:", clearTeamsP1);

      const { error: clearTeamsP2 } = await adminClient
        .from("teams")
        .update({ player2_id: null })
        .in("player2_id", playerIds);
      if (clearTeamsP2) console.error("Clear teams player2 error:", clearTeamsP2);

      // Disassociate players from auth user to avoid ON DELETE CASCADE
      const { error: detachPlayersErr } = await adminClient
        .from("players")
        .update({ user_id: null })
        .in("id", playerIds);
      if (detachPlayersErr) console.error("Detach players error:", detachPlayersErr);
    }

    // Clear user roles before deletion
    const { error: clearRolesError } = await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", userId);
    if (clearRolesError) console.error("Clear user roles error:", clearRolesError);

    // Clear system roles before deletion
    const { error: clearSystemRolesError } = await adminClient
      .from("system_roles")
      .delete()
      .eq("user_id", userId);
    if (clearSystemRolesError) console.error("Clear system roles error:", clearSystemRolesError);

    // Delete user using admin client
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      console.error("Delete user error:", deleteError);
      return new Response(JSON.stringify({ 
        error: `Fehler beim Löschen des Benutzers: ${deleteError.message}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: "Benutzer erfolgreich gelöscht" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("delete-user error:", e);
    return new Response(JSON.stringify({ 
      error: e?.message ?? "Unbekannter Fehler beim Löschen des Benutzers" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});