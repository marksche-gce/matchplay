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

    // Fetch profiles, tenant roles, and system roles
    const [profilesRes, tenantRolesRes, systemRolesRes] = await Promise.all([
      adminClient.from("profiles").select("id, display_name"),
      adminClient.from("user_roles").select("user_id, role"),
      adminClient.from("system_roles").select("user_id, role"),
    ]);

    if (profilesRes.error || tenantRolesRes.error || systemRolesRes.error) {
      console.error("Fetch data error:", profilesRes.error || tenantRolesRes.error || systemRolesRes.error);
      return new Response(
        JSON.stringify({ error: (profilesRes.error || tenantRolesRes.error || systemRolesRes.error)?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const profiles = profilesRes.data || [];
    const tenantRoles = tenantRolesRes.data || [];
    const systemRoles = systemRolesRes.data || [];
    const combined = authUsers.users.map((u: any) => {
      const profile = profiles.find((p: any) => p.id === u.id);
      const sys = systemRoles.find((r: any) => r.user_id === u.id);
      const tenantRole = tenantRoles.find((r: any) => r.user_id === u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        display_name: profile?.display_name ?? u.user_metadata?.display_name ?? null,
        created_at: u.created_at,
        role: sys?.role ?? tenantRole?.role ?? null,
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