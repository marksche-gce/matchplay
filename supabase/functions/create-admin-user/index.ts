import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the current user from the request
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('User not authenticated')
    }

    // Parse request body
    const { email, password, display_name, role, tenant_id } = await req.json()

    if (!email || !password || !display_name || !role) {
      throw new Error('Missing required fields')
    }

    // Check permissions
    const { data: sysRole } = await supabaseAdmin
      .from("system_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "system_admin")
      .maybeSingle();

    let isSystemAdmin = !!sysRole;
    let isTenantAdmin = false;
    let userTenantId = null;

    if (!isSystemAdmin) {
      // Check if user is tenant admin
      const { data: tenantRole } = await supabaseAdmin
        .from("user_roles")
        .select("role, tenant_id")
        .eq("user_id", user.id)
        .eq("role", "tenant_admin")
        .maybeSingle();

      if (tenantRole) {
        isTenantAdmin = true;
        userTenantId = tenantRole.tenant_id;
      }
    }

    if (!isSystemAdmin && !isTenantAdmin) {
      throw new Error('Insufficient permissions to create users')
    }

    // Validate tenant assignment
    if (role !== 'system_admin') {
      if (!tenant_id) {
        throw new Error('Tenant ID required for non-system-admin roles')
      }

      // Tenant admins can only create users in their own tenant
      if (isTenantAdmin && tenant_id !== userTenantId) {
        throw new Error('Can only create users in your own tenant')
      }
    }

    // Create the user using admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: display_name
      }
    })

    if (authError) {
      throw authError
    }

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        display_name: display_name
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // Continue despite profile error - it might already exist
    }

    // Assign role based on type
    if (role === 'system_admin') {
      // Create system admin role
      const { error: roleError } = await supabaseAdmin
        .from("system_roles")
        .insert({ user_id: authData.user.id, role: 'system_admin' });

      if (roleError) {
        console.error("System role creation error:", roleError);
        // Try to delete the created user if role assignment fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw new Error(`Role assignment failed: ${roleError.message}`);
      }
    } else {
      // Create tenant role
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ 
          user_id: authData.user.id, 
          role: role, 
          tenant_id: tenant_id 
        });

      if (roleError) {
        console.error("Tenant role creation error:", roleError);
        // Try to delete the created user if role assignment fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw new Error(`Role assignment failed: ${roleError.message}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `User ${display_name} created successfully with role ${role}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in create-admin-user function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to create user' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})