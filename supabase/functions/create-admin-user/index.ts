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
    const { email, password, displayName, role } = await req.json()

    // Validate admin permissions using the database function
    const { data: validationResult, error: validationError } = await supabaseClient
      .rpc('create_admin_user', {
        user_email: email,
        user_password: password,
        user_display_name: displayName,
        user_role: role
      })

    if (validationError || !validationResult.success) {
      throw new Error(validationResult?.error || validationError?.message || 'Validation failed')
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

    // Assign role
    if (role === 'system_admin') {
      // Upsert system admin role
      await supabaseAdmin.from('system_roles')
        .upsert({ user_id: authData.user.id, role: 'system_admin' }, { onConflict: 'user_id' });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User created and role assigned'
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