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

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const adminClient = createClient(supabaseUrl, serviceKey);

    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only system admins can delete globally
    const { data: isSysAdmin, error: sysErr } = await supabaseAuth.rpc('is_system_admin', { _user_id: user.id });
    if (sysErr) {
      return new Response(JSON.stringify({ error: sysErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isSysAdmin) {
      return new Response(JSON.stringify({ error: "Nur Systemadministratoren können Turniere löschen" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tournamentId } = await req.json();
    if (!tournamentId) {
      return new Response(JSON.stringify({ error: "tournamentId ist erforderlich" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete dependent data first (best effort)
    await adminClient.from('matches_new').delete().eq('tournament_id', tournamentId);
    await adminClient.from('tournament_registrations_new').delete().eq('tournament_id', tournamentId);
    await adminClient.from('teams').delete().eq('tournament_id', tournamentId);

    const { error: delErr } = await adminClient.from('tournaments_new').delete().eq('id', tournamentId);
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error('delete-tournament error:', e);
    return new Response(JSON.stringify({ error: e?.message ?? 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
