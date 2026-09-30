"use client"

import { useCallback, useEffect, useState } from "react"
import { Capacitor } from "@capacitor/core"
import { createClient } from "@/lib/supabase/client"
import { getBiometricEnabled, getStoredRefreshToken, clearStoredRefreshToken } from "@/lib/biometric-store"
import { finishLogin } from "@/lib/finish-login"

type BiometricSignInState = {
  // True once the initial availability check has settled - lets the login
  // page keep the button out of the layout entirely until it knows,
  // instead of showing then hiding it.
  checked: boolean
  // True only when there's actually a stored refresh token AND the device
  // has biometry enrolled right now - i.e. tapping "sign in with
  // fingerprint" stands a real chance of working.
  available: boolean
}

export type BiometricSignInResult =
  | { ok: true; redirectPath: string }
  | { ok: false; error: string; silent?: boolean }

/**
 * Powers the login page's "Sign in with fingerprint" button - a genuine
 * alternative to typing an email and password, not just the existing
 * app-lock gate (lib/use-app-lock.ts), which only re-reveals a session
 * that's already valid. This bridges an actually expired session by
 * exchanging a previously-stored Supabase refresh token (see
 * lib/biometric-store.ts) for a fresh one, released only after a
 * fingerprint check - the person's actual password is never stored
 * anywhere.
 *
 * A no-op everywhere outside the native Android app, and everywhere the
 * person hasn't both turned on "Unlock with fingerprint" and previously
 * signed in on this device (nothing to exchange otherwise).
 */
export function useBiometricSignIn() {
  const [state, setState] = useState<BiometricSignInState>({ checked: false, available: false })

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      setState({ checked: true, available: false })
      return
    }

    let cancelled = false

    ;(async () => {
      const [enabled, storedToken] = await Promise.all([getBiometricEnabled(), getStoredRefreshToken()])

      if (cancelled) return

      if (!enabled || !storedToken) {
        setState({ checked: true, available: false })
        return
      }

      const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth")
      const biometry = await BiometricAuth.checkBiometry().catch(() => ({ isAvailable: false }))

      if (cancelled) return

      setState({ checked: true, available: !!biometry.isAvailable })
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(async (): Promise<BiometricSignInResult> => {
    try {
      const storedToken = await getStoredRefreshToken()
      if (!storedToken) {
        return { ok: false, error: "", silent: true }
      }

      const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth")
      try {
        await BiometricAuth.authenticate({
          reason: "Sign in to RouteLink",
          cancelTitle: "Cancel",
          allowDeviceCredential: true,
          androidTitle: "Sign in to RouteLink",
          androidSubtitle: "Use your fingerprint or face to sign in",
          androidConfirmationRequired: false,
        })
      } catch {
        // Cancelled, or failed the biometric prompt itself - not a reason
        // to touch the stored token, the person can just try again (or
        // fall back to typing their password).
        return { ok: false, error: "", silent: true }
      }

      const { data, error } = await createClient().auth.refreshSession({ refresh_token: storedToken })

      if (error || !data.session || !data.user) {
        // The stored token itself is the problem (expired, revoked from
        // another device, etc.), not the fingerprint check. Clear it so
        // the app stops offering a fingerprint option that can't actually
        // work, and let the person fall back to typing credentials once -
        // which saves a fresh token automatically if they still have
        // "Unlock with fingerprint" turned on.
        await clearStoredRefreshToken().catch(() => {})
        return {
          ok: false,
          error: "Your saved sign-in has expired. Please sign in with your email and password.",
        }
      }

      const result = await finishLogin(data.user.id)
      if (!result.ok) {
        return { ok: false, error: result.error }
      }

      return { ok: true, redirectPath: result.redirectPath }
    } catch (err) {
      console.error("Biometric sign-in error:", err)
      return { ok: false, error: "An unexpected error occurred. Please try again." }
    }
  }, [])

  return { ...state, signIn }
}
