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

    // Check if caller is system admin or tenant admin
    const { data: systemRole, error: sysErr } = await adminClient
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

    const { data: tenantAdminData, error: roleErr } = await adminClient
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", user.id)
      .eq("role", "tenant_admin")
      .maybeSingle();

    if (roleErr) {
      console.error("Role check error:", roleErr);
      return new Response(JSON.stringify({ error: roleErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSystemAdmin = !!systemRole;
    const isTenantAdmin = !!tenantAdminData;

    if (!isSystemAdmin && !isTenantAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden - Admin privileges required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, displayName, role, tenantId } = await req.json();

    // Update display name in profiles table if provided
    if (displayName) {
      const { error: profileError } = await adminClient
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", userId);

      if (profileError) {
        console.error("Profile update error:", profileError);
        return new Response(
          JSON.stringify({ error: "Failed to update profile" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let responseTenantId: string | null = null;

    // Update role if provided
    if (role) {
      if (role === "system_admin") {
        // Only admins can grant system_admin; this function already verified that
        // Remove any existing system role then insert
        const { error: delSysErr } = await adminClient
          .from("system_roles")
          .delete()
          .eq("user_id", userId);
        if (delSysErr) {
          console.warn("Ignoring system role delete error (might not exist):", delSysErr);
        }

        const { error: insSysErr } = await adminClient
          .from("system_roles")
          .insert({ user_id: userId, role: "system_admin" });
        if (insSysErr) {
          console.error("System role insert error:", insSysErr);
          return new Response(
            JSON.stringify({ error: "Failed to assign system admin role" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        // Ensure no lingering system admin rights when switching away
        await adminClient.from("system_roles").delete().eq("user_id", userId);

        // Determine target tenant
        const targetTenantId = tenantId || tenantAdminData?.tenant_id || null;
        if (!targetTenantId) {
          return new Response(
            JSON.stringify({ error: "tenantId required for tenant roles" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        responseTenantId = targetTenantId;

        // Delete existing role for this tenant
        await adminClient
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("tenant_id", targetTenantId);

        // Insert new tenant role
        const { error: roleError } = await adminClient
          .from("user_roles")
          .insert({
            user_id: userId,
            tenant_id: targetTenantId,
            role: role,
          });

        if (roleError) {
          console.error("Role update error:", roleError);
          return new Response(
            JSON.stringify({ error: "Failed to update role" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "User updated successfully",
        userId,
        displayName,
        role,
        tenant_id: responseTenantId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("update-user error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});