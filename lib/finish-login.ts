import { getUserRole } from "@/app/auth/actions"

const ROLE_PATHS: Record<string, string> = {
  admin: "/admin",
  driver: "/driver",
  pharmacy: "/pharmacy",
}

export type FinishLoginResult =
  | { ok: true; redirectPath: string }
  | { ok: false; error: string }

/**
 * Shared "an authenticated Supabase user exists, now get them to their
 * portal" logic. Pulled out of the login form's submit handler so the new
 * biometric sign-in flow (lib/use-biometric-signin.ts) can reuse the exact
 * same rules - looking up the person's role, remembering it for the rest of
 * the app, and picking which portal to land on - rather than keeping two
 * copies that could quietly drift apart.
 */
export async function finishLogin(userId: string): Promise<FinishLoginResult> {
  const result = await getUserRole(userId)

  if (result.error) {
    return { ok: false, error: result.error }
  }

  if (!result.data) {
    return {
      ok: false,
      error: "User account not found. Please contact your administrator to set up your account.",
    }
  }

  const userRecord = result.data

  localStorage.setItem("userRole", userRecord.role)
  localStorage.setItem("userEmail", userRecord.email)
  localStorage.setItem("userName", `${userRecord.first_name} ${userRecord.last_name}`)

  return { ok: true, redirectPath: ROLE_PATHS[userRecord.role] || "/admin" }
}
