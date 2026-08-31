'use server'

import { createClient } from '@supabase/supabase-js'

export async function getUserRole(userId: string) {
  // Use service role key to bypass RLS policies
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('role, email, first_name, last_name')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('[v0] Server action error:', error)
    return { error: error.message }
  }

  if (!data) {
    return { error: 'User account not found in database' }
  }

  return { data }
}
