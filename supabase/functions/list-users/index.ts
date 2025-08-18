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

    // Check admin role using service role (bypass RLS safely)
    const { data: roleData, error: roleErr } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleErr) {
      console.error("Role check error:", roleErr);
      return new Response(JSON.stringify({ error: roleErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List auth users (requires service role)
    const { data: authUsers, error: authErr } = await adminClient.auth.admin.listUsers();
    if (authErr) {
      console.error("listUsers error:", authErr);
      return new Response(
        JSON.stringify({ error: authErr.message, code: authErr.code }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch profiles and roles
    const [profilesRes, rolesRes] = await Promise.all([
      adminClient.from("profiles").select("id, display_name"),
      adminClient.from("user_roles").select("user_id, role"),
    ]);

    if (profilesRes.error || rolesRes.error) {
      console.error("Fetch profiles/roles error:", profilesRes.error || rolesRes.error);
      return new Response(
        JSON.stringify({ error: (profilesRes.error || rolesRes.error)?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const profiles = profilesRes.data || [];
    const roles = rolesRes.data || [];

    const combined = authUsers.users.map((u: any) => {
      const profile = profiles.find((p: any) => p.id === u.id);
      const roleRow = roles.find((r: any) => r.user_id === u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        display_name: profile?.display_name ?? u.user_metadata?.display_name ?? null,
        created_at: u.created_at,
        role: roleRow?.role ?? "player",
      };
    });

    return new Response(JSON.stringify({ users: combined }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("list-users error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});