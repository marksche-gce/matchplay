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

    // Check if user has system_admin or tenant_admin role
    const { data: systemAdminCheck } = await supabaseAdmin
      .from('system_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'system_admin')
      .maybeSingle()

    const { data: tenantAdminCheck } = await supabaseAdmin
      .from('user_roles')
      .select('role, tenant_id')
      .eq('user_id', user.id)
      .eq('role', 'tenant_admin')
      .maybeSingle()

    const isSystemAdmin = !!systemAdminCheck
    const isTenantAdmin = !!tenantAdminCheck

    if (!isSystemAdmin && !isTenantAdmin) {
      throw new Error('Access denied. Admin privileges required.')
    }

    // Parse request body
    const { email, password, displayName, role, tenantId } = await req.json()

    // Enforce cross-tenant rules:
    // - Only system admins may create system_admin users
    // - Tenant admins can only create users within their own tenant
    if (role === 'system_admin' && !isSystemAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Only system admins can assign system_admin role' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let targetTenantId: string | null = null
    if (role !== 'system_admin') {
      if (isSystemAdmin) {
        targetTenantId = tenantId ?? null
      } else if (isTenantAdmin) {
        // Force to caller's tenant, ignore provided tenantId
        targetTenantId = tenantAdminCheck.tenant_id
      }
    }

    // Create the user using admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName
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
        display_name: displayName
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // Continue despite profile error - it might already exist
    }

    // Assign role based on type
    if (role === 'system_admin') {
      // Create system admin role
      const { error: systemRoleError } = await supabaseAdmin
        .from('system_roles')
        .insert({
          user_id: authData.user.id,
          role: 'system_admin'
        })

      if (systemRoleError) {
        throw systemRoleError
      }
    } else {
      // Create tenant role
      if (!targetTenantId) {
        throw new Error('Tenant ID required for tenant roles')
      }

      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          tenant_id: targetTenantId,
          role: role
        })

      if (roleError) {
        throw roleError
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: authData.user.id,
          email: authData.user.email,
          display_name: displayName,
          role,
          tenant_id: targetTenantId
        }
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