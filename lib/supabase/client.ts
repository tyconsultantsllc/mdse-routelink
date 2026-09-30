import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { Capacitor } from "@capacitor/core"

let client: SupabaseClient | null = null

// Inside the wrapped Android app, session tokens are kept in native
// Preferences storage (Android's own SharedPreferences-backed store) instead
// of the WebView's localStorage. The WebView's localStorage usually persists
// fine, but it isn't a *guaranteed* durable store the way a browser's is -
// Android can clear it under storage pressure, and "Clear storage" in the
// app's system settings wipes it independent of anything else. Preferences
// doesn't have that failure mode, so logins survive more reliably across
// app restarts. Supabase's auth client supports async storage adapters, so
// this just proxies to the native plugin.
//
// The web portal is untouched by this - it keeps using the default
// localStorage-backed storage, since this object is only passed in when
// running inside the native app.
function createNativeStorage() {
  return {
    async getItem(key: string) {
      const { Preferences } = await import("@capacitor/preferences")
      const { value } = await Preferences.get({ key })
      return value
    },
    async setItem(key: string, value: string) {
      const { Preferences } = await import("@capacitor/preferences")
      await Preferences.set({ key, value })
    },
    async removeItem(key: string) {
      const { Preferences } = await import("@capacitor/preferences")
      await Preferences.remove({ key })
    },
  }
}

export function createClient() {
  if (client) {
    return client
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables")
  }

  const isNative = typeof window !== "undefined" && Capacitor.isNativePlatform()

  if (typeof window !== "undefined" && !isNative) {
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
      ...(isNative ? { storage: createNativeStorage() } : {}),
    },
  })

  return client
}
