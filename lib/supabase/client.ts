import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let client: SupabaseClient | null = null

// Do NOT pass a custom `auth.storage` here. A previous version of this file
// did (to route sessions through native Preferences storage on Android
// instead of localStorage), but @supabase/ssr's createBrowserClient always
// manages the session via cookies - that's the whole point of the package,
// since it's what lets middleware.ts (running server-side) see the same
// session a page's client-side code does. Any `auth.storage` passed in is
// silently ignored (it logs a one-time console warning saying so), so that
// change never actually did anything - the real bug this app's Android
// login flow ran into (see the app-lock gate showing on the login page)
// turned out to be unrelated to storage at all.
//
// This app's WebView loads its real production URL directly (see
// capacitor.config.ts), so it authenticates exactly like a normal mobile
// browser tab - cookies persist the same way they would there.
export function createClient() {
  if (client) {
    return client
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables")
  }

  if (typeof window !== "undefined") {
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.includes("supabase.auth.token")) {
          const value = localStorage.getItem(key)
          if (value && value.trim() === "") {
            keysToRemove.push(key)
          }
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key))
    } catch (e) {
      // Ignore storage errors
    }
  }

  client = createBrowserClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })

  return client
}
