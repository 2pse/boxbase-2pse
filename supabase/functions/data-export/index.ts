import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { export_type, include_sensitive = false } = await req.json()

    console.log(`Starting data export: type=${export_type}, format=csv, include_sensitive=${include_sensitive}`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify admin authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Define table mappings for different export types
    const exportMappings: Record<string, string[]> = {
      members: ['profiles', 'user_memberships_v2', 'user_roles'],
      courses: ['courses', 'course_registrations', 'course_templates', 'waitlist_promotion_events'],
      finance: ['membership_plans_v2', 'purchase_history'],
      training: ['training_sessions', 'user_challenge_progress', 'challenge_checkpoints', 'user_badges', 'monthly_challenges', 'leaderboard_entries'],
      content: ['news', 'user_read_news', 'crossfit_workouts', 'bodybuilding_workouts'],
      settings: ['gym_settings', 'reactivation_webhook_events'],
      full: [
        'profiles', 'user_memberships_v2', 'user_roles', 'courses', 'course_registrations', 
        'course_templates', 'waitlist_promotion_events', 'membership_plans_v2', 'purchase_history',
        'training_sessions', 'user_challenge_progress', 'challenge_checkpoints', 'user_badges', 
        'monthly_challenges', 'leaderboard_entries', 'news', 'user_read_news', 'crossfit_workouts', 
        'bodybuilding_workouts', 'gym_settings', 'reactivation_webhook_events'
      ]
    }

    const tablesToExport = exportMappings[export_type] || []
    
    if (tablesToExport.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid export type' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Exporting tables: ${tablesToExport.join(', ')}`)

    const exportData: Record<string, any[]> = {}
    let totalRecords = 0

    // Export each table
    for (const tableName of tablesToExport) {
      try {
        console.log(`Exporting table: ${tableName}`)
        
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
        
        if (error) {
          console.error(`Error exporting table ${tableName}:`, error)
          exportData[tableName] = []
        } else {
          exportData[tableName] = data || []
          totalRecords += (data || []).length
          console.log(`Exported ${(data || []).length} records from ${tableName}`)
        }
      } catch (tableError) {
        console.error(`Failed to export table ${tableName}:`, tableError)
        exportData[tableName] = []
      }
    }

    // Include auth.users data if sensitive data is requested and it's a member or full export
    if (include_sensitive && (export_type === 'members' || export_type === 'full')) {
      try {
        console.log('Fetching auth.users data...')
        
        // Get all user IDs from profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id')
        
        if (profiles && profiles.length > 0) {
          const userIds = profiles.map(p => p.user_id).filter(Boolean)
          
          // Fetch users in batches to avoid API limits
          const batchSize = 100
          const authUsers = []
          
          for (let i = 0; i < userIds.length; i += batchSize) {
            const batch = userIds.slice(i, i + batchSize)
            const { data: batchUsers, error: batchError } = await supabase.auth.admin.listUsers({
              page: Math.floor(i / batchSize) + 1,
              perPage: batchSize
            })
            
            if (!batchError && batchUsers?.users) {
              const filteredUsers = batchUsers.users
                .filter(user => batch.includes(user.id))
                .map(user => ({
                  id: user.id,
                  email: user.email,
                  phone: user.phone,
                  email_confirmed_at: user.email_confirmed_at,
                  phone_confirmed_at: user.phone_confirmed_at,
                  last_sign_in_at: user.last_sign_in_at,
                  created_at: user.created_at,
                  updated_at: user.updated_at,
                  user_metadata: user.user_metadata,
                  app_metadata: user.app_metadata,
                  // Note: encrypted_password is not accessible via API for security
                }))
              
              authUsers.push(...filteredUsers)
            }
          }
          
          exportData['auth_users'] = authUsers
          totalRecords += authUsers.length
          console.log(`Exported ${authUsers.length} auth users`)
        }
      } catch (authError) {
        console.error('Error fetching auth users:', authError)
        exportData['auth_users'] = []
      }
    }

    console.log(`Export completed. Total records: ${totalRecords}`)

    // Generate timestamp for filenames
    const timestamp = new Date().toISOString().split('T')[0]
    
    // Create separate CSV files for each table and trigger downloads
    const csvFiles = []
    let totalSize = 0

    for (const [tableName, records] of Object.entries(exportData)) {
      if (records.length === 0) continue
      
      // Create CSV content for this table
      const headers = Object.keys(records[0])
      let csvContent = headers.join(',') + '\n'
      
      // Add data rows
      for (const record of records) {
        const row = headers.map(header => {
          let value = record[header]
          if (value === null || value === undefined) return ''
          if (typeof value === 'object') value = JSON.stringify(value)
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return String(value)
        })
        csvContent += row.join(',') + '\n'
      }

      const fileName = `${tableName}_${timestamp}.csv`
      const base64Content = btoa(unescape(encodeURIComponent(csvContent)))
      const dataUrl = `data:text/csv;base64,${base64Content}`
      
      csvFiles.push({
        name: fileName,
        download_url: dataUrl,
        size_bytes: new TextEncoder().encode(csvContent).length,
        records: records.length
      })
      
      totalSize += new TextEncoder().encode(csvContent).length
    }

    console.log(`Created ${csvFiles.length} separate CSV files`)
    
    const totalSizeKB = Math.round(totalSize / 1024)
    const totalSizeFormatted = totalSizeKB > 1024 
      ? `${Math.round(totalSizeKB / 1024 * 10) / 10} MB`
      : `${totalSizeKB} KB`

    console.log(`Export successful: ${csvFiles.length} CSV files (${totalSizeFormatted})`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        csv_files: csvFiles,
        total_records: totalRecords,
        tables_exported: csvFiles.length,
        total_size: totalSizeFormatted
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Data export error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})