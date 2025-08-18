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

    // First, clear any references to this user in matches before deletion
    const { error: clearMatchesError } = await adminClient
      .from("matches")
      .update({ winner_id: null })
      .eq("winner_id", userId);

    if (clearMatchesError) {
      console.error("Clear matches error:", clearMatchesError);
    }

    // Also clear references in matches_new table
    const { error: clearMatchesNewError } = await adminClient
      .from("matches_new")
      .update({ 
        winner_player_id: null,
        winner_team_id: null 
      })
      .or(`winner_player_id.eq.${userId},winner_team_id.eq.${userId}`);

    if (clearMatchesNewError) {
      console.error("Clear matches_new error:", clearMatchesNewError);
    }

    // Clear user roles before deletion
    const { error: clearRolesError } = await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (clearRolesError) {
      console.error("Clear user roles error:", clearRolesError);
    }

    // Clear system roles before deletion
    const { error: clearSystemRolesError } = await adminClient
      .from("system_roles")
      .delete()
      .eq("user_id", userId);

    if (clearSystemRolesError) {
      console.error("Clear system roles error:", clearSystemRolesError);
    }

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