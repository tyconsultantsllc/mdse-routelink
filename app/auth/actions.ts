'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function getUserRole(userId: string) {
  // This is a Next.js Server Action, which means it's directly callable
  // from any client with any userId - not just from finishLogin() right
  // after a real sign-in, the way the app's own UI calls it. Without this
  // check, anyone (signed in or not) could call getUserRole() with any
  // user's UUID and get back their role/email/name, no login required.
  // The session cookie is the only thing actually trustworthy here - by the
  // time this runs, signInWithPassword()/refreshSession() has already set
  // it (see app/auth/login/page.tsx and lib/use-biometric-signin.ts), so
  // this never has to loosen the check for the legitimate callers.
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not signed in' }
  }
  if (user.id !== userId) {
    return { error: 'Forbidden' }
  }

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
    .select('role, email, first_name, last_name, drivers(active)')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('[v0] Server action error:', error)
    return { error: error.message }
  }

  if (!data) {
    return { error: 'User account not found in database' }
  }

  // A deactivated driver (see app/admin/users - "Deactivate" rather than
  // delete, so their delivery history stays intact) shouldn't be able to
  // finish signing in at all. `drivers` is a single nested object here (see
  // lib/region-utils.ts's getDriverDetails for why), and only exists for
  // driver accounts, so a missing/undefined `active` never blocks anyone
  // else.
  const driverRow = Array.isArray((data as any).drivers) ? (data as any).drivers[0] : (data as any).drivers
  if (data.role === 'driver' && driverRow?.active === false) {
    return { error: 'This account has been deactivated. Contact your admin for assistance.' }
  }

  return { data }
}
