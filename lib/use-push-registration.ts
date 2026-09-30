"use client"

/**
 * Registers this device for push notifications, once, whenever a signed-in
 * user with a stable id is available. No-ops entirely in a regular browser
 * tab (isNativeApp() is false there) - push notifications are an
 * Android-app-only feature; the web app's own in-app notification bell
 * (lib/use-notifications.ts) is what everyone else gets.
 *
 * This only gets a device as far as "able to receive a push" - whether one
 * actually arrives also depends on the server having Firebase configured
 * (lib/push.ts) and the native android/app/google-services.json file
 * being in place (see SETUP.md). Until both of those are done, registration
 * itself will simply fail quietly (caught below) or never produce a token -
 * same fail-open shape as the rest of the app's optional integrations.
 */
import { useEffect, useRef } from "react"
import { isNativeApp } from "@/lib/native-file"
import { savePushToken } from "@/app/actions/data-actions"

export function usePushRegistration(userId: string | null | undefined) {
  const registeredForRef = useRef<string | null>(null)

  useEffect(() => {
    if (!userId || !isNativeApp() || registeredForRef.current === userId) return
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
