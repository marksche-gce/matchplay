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

    // Verify system admin
    const { data: isSysAdmin, error: sysErr } = await supabaseAuth.rpc('is_system_admin', { _user_id: user.id });
    if (sysErr) {
      return new Response(JSON.stringify({ error: sysErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isSysAdmin) {
      return new Response(JSON.stringify({ error: "Nur Systemadministratoren können Turniere global erstellen" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { name, type, max_players, start_date, end_date, registration_status, tenant_id } = body ?? {};

    if (!name || !type || !max_players || !start_date || !end_date || !tenant_id) {
      return new Response(JSON.stringify({ error: "Fehlende Felder" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create tournament using service role to bypass RLS safely
    const { data: tournament, error: insertErr } = await adminClient
      .from('tournaments_new')
      .insert({
        name,
        type,
        max_players,
        start_date,
        end_date,
        registration_status,
        tenant_id,
      })
      .select()
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, tournament }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error('create-tournament error:', e);
    return new Response(JSON.stringify({ error: e?.message ?? 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
