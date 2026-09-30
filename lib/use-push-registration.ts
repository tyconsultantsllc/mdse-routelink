"use client"

/**
 * Registers this device for push notifications, once, whenever a signed-in
 * user with a stable id is available. No-ops entirely in a regular browser
 * tab (isNativeApp() is false there) - push notifications are an
 * Android-app-only feature; the web app's own in-app notification bell
 * (lib/use-notifications.ts) is what everyone else gets.
 *
 * Gated behind NEXT_PUBLIC_PUSH_NOTIFICATIONS_ENABLED, which should stay
 * unset/"false" until android/app/google-services.json is actually in
 * place (see SETUP.md). This isn't just "quieter until configured" - the
 * underlying @capacitor/push-notifications plugin calls straight into the
 * Firebase Android SDK with no guard of its own, and when Firebase hasn't
 * been initialized (no google-services.json), that throws an uncaught
 * native exception that crashes the whole app, not a rejected promise this
 * file could catch. So this flag is a hard gate, not a soft default: flip
 * it to "true" only after Firebase setup is done and the app has been
 * rebuilt with google-services.json present.
 */
import { useEffect, useRef } from "react"
import { isNativeApp } from "@/lib/native-file"
import { savePushToken } from "@/app/actions/data-actions"

const PUSH_ENABLED = process.env.NEXT_PUBLIC_PUSH_NOTIFICATIONS_ENABLED === "true"

export function usePushRegistration(userId: string | null | undefined) {
  const registeredForRef = useRef<string | null>(null)

  useEffect(() => {
    if (!PUSH_ENABLED || !userId || !isNativeApp() || registeredForRef.current === userId) return
    registeredForRef.current = userId

    let removeListeners: (() => void) | undefined

    ;(async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications")

        const permission = await PushNotifications.checkPermissions()
        let granted = permission.receive === "granted"
        if (!granted && permission.receive !== "denied") {
          const requested = await PushNotifications.requestPermissions()
          granted = requested.receive === "granted"
        }
        if (!granted) return

        const registrationListener = await PushNotifications.addListener("registration", (token) => {
          savePushToken(token.value, "android").catch((error) =>
            console.error("Failed to save push token:", error),
          )
        })
        const registrationErrorListener = await PushNotifications.addListener("registrationError", (error) => {
          // Expected until android/app/google-services.json is in place -
          // logged for visibility during setup, nothing more.
          console.warn("Push registration error (Firebase not set up yet?):", error)
        })

        removeListeners = () => {
          registrationListener.remove()
          registrationErrorListener.remove()
        }

        await PushNotifications.register()
      } catch (error) {
        // The plugin throws if Firebase/Google Play services aren't
        // available yet - never let that break the app it's attached to.
        console.warn("Push registration unavailable:", error)
      }
    })()

    return () => removeListeners?.()
  }, [userId])
}
