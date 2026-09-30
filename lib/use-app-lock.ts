"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Capacitor } from "@capacitor/core"
import { createClient } from "@/lib/supabase/client"
import { BIOMETRIC_ENABLED_KEY, saveRefreshToken, clearStoredRefreshToken } from "@/lib/biometric-store"

// Routes middleware.ts already treats as not requiring a logged-in user
// (see the matching check there). The lock screen has no business
// appearing on these: there's nothing behind it worth protecting, and
// showing it here is actively misleading if it ever does - see below.
function isPublicPath(pathname: string | null): boolean {
  return !pathname || pathname === "/" || pathname.startsWith("/auth") || pathname.startsWith("/track")
}

type AppLockState = {
  // True once the initial native/availability/session checks have settled -
  // used to avoid flashing an unlock screen (or app content) based on
  // incomplete information.
  checked: boolean
  // True only inside the wrapped Android app - this feature doesn't exist
  // on the plain website, so every caller can just check this once instead
  // of re-deriving Capacitor.isNativePlatform() themselves.
  isNative: boolean
  // Whether the device itself actually has biometry enrolled and usable by
  // apps right now (independent of whether the user has turned this on).
  isAvailable: boolean
  // The user's own opt-in choice, persisted in native Preferences storage
  // (a device setting, not something that should log out along with a
  // session).
  enabled: boolean
  // Whether the lock screen should be covering the app right now.
  locked: boolean
}

/**
 * Drives "unlock the app with fingerprint/face" end to end: checks device
 * biometry availability, reads/writes the opt-in preference, and re-locks
 * the app every time it returns from the background (not just on cold
 * start) so stepping away for a minute re-applies the same protection as
 * a fresh launch.
 *
 * Only ever locks when there's an actual logged-in session to protect -
 * if nobody's logged in yet, the login screen itself is the gate, and
 * prompting for a fingerprint in front of it would just be an extra step
 * for nothing.
 *
 * That "is there a session" check uses the client SDK's fast getSession(),
 * which trusts whatever's cached locally rather than asking the server -
 * it can say yes for a moment or two after the real session has actually
 * gone stale/expired server-side (this app's middleware.ts is what
 * actually decides that, on every navigation). Locking only on routes
 * middleware.ts treats as requiring a user (see isPublicPath) means that
 * gap can never actually surface as a bug: if the server had already
 * decided to send someone to the login page, the lock screen simply won't
 * appear there, rather than prompting for a fingerprint scan that then
 * reveals a login form anyway.
 *
 * This hook also doubles as the one place that keeps a Supabase refresh
 * token mirrored into native storage (lib/biometric-store.ts) while the
 * person is opted in, via a single onAuthStateChange listener: saved on
 * SIGNED_IN/TOKEN_REFRESHED, cleared on SIGNED_OUT. That's what lets the
 * login page's separate "sign in with fingerprint" flow
 * (lib/use-biometric-signin.ts) bridge a genuinely expired session later,
 * without ever storing the person's actual password - see
 * lib/biometric-store.ts for the reasoning behind that trade-off.
 *
 * A no-op everywhere outside the native Android app: `isNative` stays
 * false, `locked` stays false, and nothing here ever touches the plain
 * website.
 */
export function useAppLock() {
  const [state, setState] = useState<AppLockState>({
    checked: false,
    isNative: false,
    isAvailable: false,
    enabled: false,
    locked: false,
  })
  const listenerRef = useRef<{ remove: () => void } | null>(null)
  const authListenerRef = useRef<{ unsubscribe: () => void } | null>(null)
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  // Mirrors state.enabled for the onAuthStateChange callback below, which
  // is registered once on mount and would otherwise only ever see the
  // `enabled` value that was current at that moment.
  const enabledRef = useRef(false)

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      setState((s) => ({ ...s, checked: true }))
      return
    }

    let cancelled = false

    ;(async () => {
      const [{ BiometricAuth }, { Preferences }, { App }] = await Promise.all([
        import("@aparajita/capacitor-biometric-auth"),
        import("@capacitor/preferences"),
        import("@capacitor/app"),
      ])

      const [biometryResult, stored, session] = await Promise.all([
        BiometricAuth.checkBiometry().catch(() => ({ isAvailable: false })),
        Preferences.get({ key: BIOMETRIC_ENABLED_KEY }),
        createClient()
          .auth.getSession()
          .then(({ data }) => data.session),
      ])

      if (cancelled) return

      const isAvailable = !!biometryResult.isAvailable
      const enabled = stored.value === "true" && isAvailable
      enabledRef.current = enabled

      setState({
        checked: true,
        isNative: true,
        isAvailable,
        enabled,
        // Lock right away on cold start if the user opted in, there's
        // actually a session to protect, and we're not sitting on a page
        // (login, tracking) that doesn't need protecting in the first
        // place - see isPublicPath.
        locked: enabled && !!session && !isPublicPath(pathnameRef.current),
      })

      const listener = await App.addListener("appStateChange", ({ isActive }: { isActive: boolean }) => {
        if (isActive) return
        // Going to background - re-check both the preference and the
        // session fresh (rather than trusting closed-over state, since
        // either could have changed since mount) before deciding to
        // re-lock on the next resume.
        Promise.all([
          Preferences.get({ key: BIOMETRIC_ENABLED_KEY }),
          createClient()
            .auth.getSession()
            .then(({ data }) => data.session),
        ]).then(([{ value }, activeSession]) => {
          if (value === "true" && activeSession && !isPublicPath(pathnameRef.current)) {
            setState((s) => (s.isAvailable ? { ...s, locked: true } : s))
          }
        })
      })
      listenerRef.current = listener

      // Keep the stored refresh token in sync with whatever Supabase
      // itself decides the session is. Only saves one while the person has
      // opted in (enabledRef - checked fresh each time, not captured at
      // mount), and always clears it on sign-out so a signed-out device
      // can never use a leftover token to quietly resume someone else's
      // session.
      const {
        data: { subscription },
      } = createClient().auth.onAuthStateChange((event, changedSession) => {
        if (cancelled) return
        if (event === "SIGNED_OUT") {
          clearStoredRefreshToken().catch(() => {})
          return
        }
        if (
          (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") &&
          enabledRef.current &&
          changedSession?.refresh_token
        ) {
          saveRefreshToken(changedSession.refresh_token).catch(() => {})
        }
      })
      authListenerRef.current = subscription
    })()

    return () => {
      cancelled = true
      listenerRef.current?.remove()
      authListenerRef.current?.unsubscribe()
    }
  }, [])

  const setEnabled = useCallback(async (value: boolean) => {
    const { Preferences } = await import("@capacitor/preferences")
    await Preferences.set({ key: BIOMETRIC_ENABLED_KEY, value: value ? "true" : "false" })
    enabledRef.current = value
    setState((s) => ({ ...s, enabled: value }))

    if (!value) {
      // Turning the setting off should also drop any already-stored
      // refresh token - otherwise it wouldn't actually stop biometric
      // sign-in from working on the login page, just hide the app-lock
      // toggle.
      await clearStoredRefreshToken().catch(() => {})
    } else {
      // Turning it on: capture whatever session already exists right now,
      // so there's something for "sign in with fingerprint" to use
      // immediately rather than waiting for the next sign-in/token-refresh
      // event.
      const { data } = await createClient().auth.getSession()
      if (data.session?.refresh_token) {
        await saveRefreshToken(data.session.refresh_token).catch(() => {})
      }
    }
  }, [])

  const unlock = useCallback(async (): Promise<boolean> => {
    try {
      const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth")
      await BiometricAuth.authenticate({
        reason: "Unlock RouteLink",
        cancelTitle: "Cancel",
        allowDeviceCredential: true,
        androidTitle: "Unlock RouteLink",
        androidSubtitle: "Use your fingerprint or face to continue",
        androidConfirmationRequired: false,
      })
      setState((s) => ({ ...s, locked: false }))
      return true
    } catch {
      return false
    }
  }, [])

  return { ...state, setEnabled, unlock }
}
