// Low-level, plain (non-React) helpers around the native Preferences keys
// this app's two biometric features share:
//   - ENABLED_KEY: the person's own opt-in choice ("Unlock with fingerprint"
//     in Settings), read by both features.
//   - REFRESH_TOKEN_KEY: a Supabase refresh token, saved only when the
//     person is signed in AND has opted in, and used to sign back in
//     silently after a fingerprint check - see lib/use-biometric-signin.ts.
//     Cleared the moment they sign out, so a signed-out device can't use it
//     to sign back in on its own.
//
// This does NOT store the person's actual email/password anywhere - only
// Supabase's own refresh token, which is exactly what the site's normal
// cookie-based session already relies on. Preferences is Android's own
// per-app private storage (not readable by other apps without root), the
// same place the "Unlock with fingerprint" setting itself already lives -
// not hardware-Keystore-bound the way a full biometric-crypto integration
// would be, which is a deliberate, discussed trade-off favoring shipping
// something solid today over a second native plugin's worth of risk.

export const BIOMETRIC_ENABLED_KEY = "app_lock_biometric_enabled"
export const BIOMETRIC_REFRESH_TOKEN_KEY = "app_lock_refresh_token"

export async function getBiometricEnabled(): Promise<boolean> {
  const { Preferences } = await import("@capacitor/preferences")
  const { value } = await Preferences.get({ key: BIOMETRIC_ENABLED_KEY })
  return value === "true"
}

export async function setBiometricEnabled(value: boolean): Promise<void> {
  const { Preferences } = await import("@capacitor/preferences")
  await Preferences.set({ key: BIOMETRIC_ENABLED_KEY, value: value ? "true" : "false" })
}

export async function getStoredRefreshToken(): Promise<string | null> {
  const { Preferences } = await import("@capacitor/preferences")
  const { value } = await Preferences.get({ key: BIOMETRIC_REFRESH_TOKEN_KEY })
  return value ?? null
}

export async function saveRefreshToken(token: string): Promise<void> {
  const { Preferences } = await import("@capacitor/preferences")
  await Preferences.set({ key: BIOMETRIC_REFRESH_TOKEN_KEY, value: token })
}

export async function clearStoredRefreshToken(): Promise<void> {
  const { Preferences } = await import("@capacitor/preferences")
  await Preferences.remove({ key: BIOMETRIC_REFRESH_TOKEN_KEY })
}
