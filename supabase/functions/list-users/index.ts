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

    // Check if user is system admin or tenant admin
    const [systemAdminCheck, tenantAdminCheck] = await Promise.all([
      adminClient
        .from("system_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "system_admin")
        .maybeSingle(),
      adminClient
        .from("user_roles")
        .select("role, tenant_id")
        .eq("user_id", user.id)
        .eq("role", "tenant_admin")
        .maybeSingle()
    ]);

    const isSystemAdmin = !!systemAdminCheck.data;
    const isTenantAdmin = !!tenantAdminCheck.data;

    if (!isSystemAdmin && !isTenantAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden - Admin privileges required" }), {
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
    let rolesQuery = adminClient
      .from("user_roles")
      .select(`
        user_id, 
        role, 
        tenant_id,
        tenants:tenant_id (
          name,
          slug
        )
      `);

    // If tenant admin, only show users from their tenant
    if (!isSystemAdmin && isTenantAdmin) {
      rolesQuery = rolesQuery.eq("tenant_id", tenantAdminCheck.data!.tenant_id);
    }

    const [profilesRes, rolesRes] = await Promise.all([
      adminClient.from("profiles").select("id, display_name"),
      rolesQuery,
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

    // Filter auth users based on permission level
    let filteredAuthUsers = authUsers.users;
    if (!isSystemAdmin && isTenantAdmin) {
      // Tenant admin: only show users from their tenant
      const tenantUserIds = roles.map(r => r.user_id);
      filteredAuthUsers = authUsers.users.filter(u => tenantUserIds.includes(u.id));
    }

    const combined = filteredAuthUsers.map((u: any) => {
      const profile = profiles.find((p: any) => p.id === u.id);
      const userRoles = roles.filter((r: any) => r.user_id === u.id);
      
      return {
        id: u.id,
        email: u.email ?? "",
        display_name: profile?.display_name ?? u.user_metadata?.display_name ?? null,
        created_at: u.created_at,
        roles: userRoles.map(r => ({
          role: r.role,
          tenant_id: r.tenant_id,
          tenant_name: r.tenants?.name || 'Unknown',
          tenant_slug: r.tenants?.slug || 'unknown'
        })),
        // For backwards compatibility, include primary role
        role: userRoles[0]?.role || "player"
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