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

    // Check permissions - system admin or tenant admin
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

    const isSystemAdmin = !!sysRole;
    let adminTenantId: string | null = null;
    
    // If not system admin, check if user is tenant admin
    if (!isSystemAdmin) {
      const { data: tenantAdminRole, error: tenantErr } = await adminClient
        .from('user_roles')
        .select('tenant_id, role')
        .eq('user_id', user.id)
        .eq('role', 'tenant_admin')
        .maybeSingle();

      if (tenantErr) {
        console.error('Tenant admin role check error:', tenantErr);
        return new Response(JSON.stringify({ error: tenantErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!tenantAdminRole) {
        return new Response(JSON.stringify({ error: 'Nur System- oder Mandantenadministratoren können Benutzer bearbeiten' }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      adminTenantId = tenantAdminRole.tenant_id as string;
    }

    // Get the user data to update from request
    const { userId, displayName, role } = await req.json();
    
    if (!userId) {
      return new Response(JSON.stringify({ error: "Benutzer-ID ist erforderlich" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update display name in profiles table
    if (displayName) {
      // Tenant admins can only edit users in their tenant
      if (!isSystemAdmin) {
        const { data: targetTenantRole } = await adminClient
          .from('user_roles')
          .select('id')
          .eq('user_id', userId)
          .eq('tenant_id', adminTenantId as string)
          .maybeSingle();
        if (!targetTenantRole) {
          return new Response(JSON.stringify({ 
            error: 'Sie können nur Benutzer in Ihrem eigenen Mandanten bearbeiten' 
          }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { error: profileError } = await adminClient
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", userId);

      if (profileError) {
        console.error("Profile update error:", profileError);
        return new Response(JSON.stringify({ 
          error: `Fehler beim Aktualisieren des Anzeigenamens: ${profileError.message}` 
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update role
    if (role) {
      if (role === 'system_admin') {
        if (!isSystemAdmin) {
          return new Response(JSON.stringify({ 
            error: 'Nur Systemadministratoren können Systemrollen vergeben' 
          }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Clear any existing tenant roles first
        await adminClient
          .from('user_roles')
          .delete()
          .eq('user_id', userId);
        
        // Upsert into system_roles
        const { error: sysRoleUpsertError } = await adminClient
          .from('system_roles')
          .upsert({ user_id: userId, role: 'system_admin' }, { onConflict: 'user_id' });
        if (sysRoleUpsertError) {
          console.error('System role update error:', sysRoleUpsertError);
          return new Response(JSON.stringify({ 
            error: `Fehler beim Aktualisieren der Systemrolle: ${sysRoleUpsertError.message}` 
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else if (['tenant_admin', 'organizer', 'manager'].includes(role)) {
        // Clear any existing system role first
        await adminClient
          .from('system_roles')
          .delete()
          .eq('user_id', userId);

        let tenantId: string | null = null;
        
        if (isSystemAdmin) {
          // For system admins, use user's existing tenant or fallback to 'standard'
          const { data: currentRole } = await adminClient
            .from('user_roles')
            .select('tenant_id')
            .eq('user_id', userId)
            .limit(1)
            .single();
          tenantId = currentRole?.tenant_id ?? null;
          
          if (!tenantId) {
            const { data: defaultTenant } = await adminClient
              .from('tenants')
              .select('id')
              .eq('slug', 'standard')
              .single();
            tenantId = defaultTenant?.id ?? null;
            if (!tenantId) {
              return new Response(JSON.stringify({ 
                error: "Kein Standard-Mandant gefunden. Kontaktieren Sie den Systemadministrator." 
              }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
        } else {
          // Tenant admins can only assign roles within their own tenant
          tenantId = adminTenantId as string;
        }

        // Upsert tenant role (insert or update)
        const { error: tenantRoleError } = await adminClient
          .from('user_roles')
          .upsert({ user_id: userId, tenant_id: tenantId, role }, { onConflict: 'user_id,tenant_id' });

        if (tenantRoleError) {
          console.error('Tenant role update error:', tenantRoleError);
          return new Response(JSON.stringify({ 
            error: `Fehler beim Aktualisieren der Mandantenrolle: ${tenantRoleError.message}` 
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: "Benutzer erfolgreich aktualisiert" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("update-user error:", e);
    return new Response(JSON.stringify({ 
      error: e?.message ?? "Unbekannter Fehler beim Aktualisieren des Benutzers" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});