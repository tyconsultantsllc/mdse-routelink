/**
 * Push notifications, sent through Firebase Cloud Messaging (FCM).
 *
 * Server-only - this reads a Firebase service account's private key, a
 * secret, so it must never be imported into a "use client" file. It's
 * called from lib/notifications.ts.
 *
 * Configuration is optional. Until FIREBASE_PROJECT_ID,
 * FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are all set, every
 * function here quietly no-ops (logged, never thrown) - so the app (and
 * its in-app notification bell) behaves exactly the same either way; only
 * the actual push-to-device part is skipped until then. See
 * SETUP.md for how to get these three values from the Firebase console.
 */
import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getMessaging } from "firebase-admin/messaging"

function getFirebaseApp() {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  // Vercel (and most env-var UIs) can't hold a literal multi-line value
  // cleanly, so the private key is stored with escaped "\n" sequences and
  // un-escaped here.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (!projectId || !clientEmail || !privateKey) {
    return null
  }

  const existing = getApps()
  if (existing.length > 0) return existing[0]

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  })
}

export interface PushResult {
  sent: number
  skipped?: boolean
  error?: string
}

/**
 * Sends one push notification to every device a user has registered
 * (lib/use-push-registration.ts saves one row per device to push_tokens
 * via the savePushToken server action). Never throws - a user with no
 * registered devices, or Firebase not being configured yet, should never
 * break whatever database write triggered this.
 */
export async function sendPushToUser(
  supabase: { from: (table: string) => any },
  userId: string,
  notification: { title: string; body: string },
): Promise<PushResult> {
  const app = getFirebaseApp()
  if (!app) {
    console.warn("Push not sent (Firebase is not configured yet):", notification.title)
    return { sent: 0, skipped: true, error: "Firebase is not configured" }
  }

  const { data: tokens, error } = await supabase.from("push_tokens").select("token").eq("user_id", userId)

  if (error || !tokens || tokens.length === 0) {
    return { sent: 0, skipped: true, error: error?.message ?? "No registered devices" }
  }

  const messaging = getMessaging(app)
  let sent = 0

  await Promise.all(
    tokens.map(async (row: any) => {
      try {
        await messaging.send({
          token: row.token,
          notification: { title: notification.title, body: notification.body },
        })
        sent++
      } catch (err: any) {
        // A token stops being valid when the app is uninstalled or the
        // device un-registers - clean those up so this list doesn't grow
        // stale, rather than retrying a token that will never work again.
        if (
          err?.code === "messaging/registration-token-not-registered" ||
          err?.code === "messaging/invalid-registration-token"
        ) {
          await supabase.from("push_tokens").delete().eq("token", row.token)
        } else {
          console.error("Failed to send push notification:", err instanceof Error ? err.message : err)
        }
      }
    }),
  )

  return { sent }
}
