/**
 * In-app + push notifications.
 *
 * Server-only (imported from app/actions/data-actions.ts, which is
 * 'use server'). This replaces the earlier SMS-based approach in
 * lib/sms.ts for the two events that used to text people: a driver being
 * assigned a route, and a pharmacy's delivery being marked
 * delivered/failed. Both keep their original function names and
 * signatures so the call sites in data-actions.ts didn't need to change,
 * just the import.
 *
 * Each notification does two things, both best-effort:
 *   1. Writes a row to the `notifications` table (scripts/030_notifications.sql),
 *      which the recipient's in-app bell picks up on its next poll -
 *      always works, no setup required.
 *   2. Sends a real push notification via lib/push.ts to any of that
 *      user's registered devices - only works once Firebase is configured
 *      (see lib/push.ts), and silently no-ops until then, same as the SMS
 *      helpers used to silently no-op until Twilio was configured.
 */
import { sendPushToUser } from "@/lib/push"

export interface NotifyResult {
  success: boolean
  skipped?: boolean
  error?: string
}

/**
 * Creates one notification for one user: inserts the row, then fires the
 * push send in the background. `supabase` should be an admin client - the
 * recipient is very often not the person making the request (an admin
 * assigning a route to a driver, a driver completing a pharmacy's
 * delivery), so this always needs to bypass RLS to write into someone
 * else's notifications.
 */
async function createNotification(
  supabase: { from: (table: string) => any },
  params: {
    userId: string
    severity?: "info" | "success" | "warning" | "error"
    title: string
    message: string
    routeId?: string | null
    routeStopId?: string | null
  },
): Promise<NotifyResult> {
  const { error } = await supabase.from("notifications").insert({
    user_id: params.userId,
    severity: params.severity ?? "info",
    title: params.title,
    message: params.message,
    route_id: params.routeId ?? null,
    route_stop_id: params.routeStopId ?? null,
  })

  if (error) {
    console.error("Failed to create notification:", error.message)
    return { success: false, error: error.message }
  }

  // Fire-and-forget - a missing/unconfigured Firebase setup, or a user with
  // no registered devices yet, should never fail the notification itself;
  // the in-app row above is already saved either way.
  sendPushToUser(supabase, params.userId, { title: params.title, body: params.message }).catch((err) =>
    console.error("Push send failed:", err instanceof Error ? err.message : err),
  )

  return { success: true }
}

/**
 * Notifies a driver they've been assigned a route.
 */
export async function notifyDriverRouteAssigned(
  supabase: { from: (table: string) => any },
  driverId: string,
  route: { name: string; startTime?: string | null },
): Promise<NotifyResult> {
  const when = route.startTime
    ? ` starting ${new Date(route.startTime).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`
    : ""

  return createNotification(supabase, {
    userId: driverId,
    severity: "info",
    title: "New route assigned",
    message: `You've been assigned "${route.name}"${when}. Open the app to review and confirm.`,
  })
}

/**
 * Notifies a pharmacy's users that a delivery to them was just delivered
 * or failed. Only notifies pharmacy_users rows with notify_on_delivery =
 * true (already on the schema, defaults to true) - so a pharmacy contact
 * can still opt out, same as before. Unlike the old SMS version, there's
 * no separate "notifications_sms" gate to also check: an in-app
 * notification costs nothing to show, so it's controlled by the one
 * event-level toggle rather than a channel-specific one.
 */
export async function notifyPharmacyDeliveryResult(
  supabase: { from: (table: string) => any },
  pharmacyId: string,
  result: { status: "delivered" | "failed"; routeName?: string | null; reason?: string | null },
): Promise<NotifyResult[]> {
  const { data: recipients, error } = await supabase
    .from("pharmacy_users")
    .select("id")
    .eq("pharmacy_id", pharmacyId)
    .eq("notify_on_delivery", true)

  if (error || !recipients || recipients.length === 0) {
    return []
  }

  const title = result.status === "delivered" ? "Delivery completed" : "Delivery could not be completed"
  const message =
    result.status === "delivered"
      ? `Your delivery${result.routeName ? ` (${result.routeName})` : ""} has been delivered.`
      : `Your delivery${result.routeName ? ` (${result.routeName})` : ""} could not be completed${
          result.reason ? `: ${result.reason}` : ""
        }. Our team will follow up.`

  return Promise.all(
    recipients.map((r: any) =>
      createNotification(supabase, {
        userId: r.id,
        severity: result.status === "delivered" ? "success" : "warning",
        title,
        message,
      }),
    ),
  )
}
