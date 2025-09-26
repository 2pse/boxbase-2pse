import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateAdminProfileRequest {
  email?: string;
  password?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { 
          status: 401, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Extract JWT token
    const jwt = authHeader.replace('Bearer ', '');

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Admin client for performing privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT token directly with admin client
    const { data: { user }, error: jwtError } = await supabaseAdmin.auth.getUser(jwt);
    
    if (jwtError || !user) {
      console.error('JWT verification failed:', jwtError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { 
          status: 401, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }
    
    console.log('User authenticated successfully:', user.id, user.email);

    // Check if user has admin role
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { 
          status: 403, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Parse request body
    const { email, password }: UpdateAdminProfileRequest = await req.json();

    if (!email && !password) {
      return new Response(
        JSON.stringify({ error: 'Either email or password must be provided' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    console.log(`Admin ${user.id} updating own profile:`, { 
      email: email ? `from ${user.email} to ${email}` : 'unchanged', 
      password: password ? 'updating password' : 'password unchanged' 
    });

    // Prepare update data
    const updateData: any = {};
    if (email) updateData.email = email;
    if (password) updateData.password = password;

    // Update admin's own authentication data using admin client
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      updateData
    );

    if (authUpdateError) {
      console.error('Auth update error:', authUpdateError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to update profile', 
          details: authUpdateError.message 
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    console.log(`Successfully updated admin profile for ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Admin profile updated successfully',
        updated: {
          email: email ? true : false,
          password: password ? true : false
        }
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );

  } catch (error) {
    console.error('Error in update-admin-profile function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
});