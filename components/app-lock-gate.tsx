"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Fingerprint } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAppLock } from "@/lib/use-app-lock"

/**
 * Wraps the whole app. Renders its children untouched unless the person has
 * turned on "Unlock with fingerprint" (see BiometricLockSetting, in each
 * portal's Settings dialog) in the native Android app and there's a logged-
 * in session to protect - see useAppLock for exactly when that's true. When
 * locked, this covers the full screen so nothing behind it (route details,
 * addresses, signatures) is visible until authentication succeeds.
 */
export function AppLockGate({ children }: { children: React.ReactNode }) {
  const { checked, locked, promptTick, unlock } = useAppLock()
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [failed, setFailed] = useState(false)

  const handleUnlock = async () => {
    setIsUnlocking(true)
    setFailed(false)
    const success = await unlock()
    setIsUnlocking(false)
    if (!success) setFailed(true)
  }

  useEffect(() => {
    if (!locked) setFailed(false)
  }, [locked])

  useEffect(() => {
    // promptTick only ticks at moments useAppLock has confirmed are
    // actually safe to show the native prompt in (cold start, or genuinely
    // back in the foreground) - never while still backgrounded, which is
    // what used to make this fire, fail invisibly with no dialog ever
    // shown, and leave "Authentication failed" waiting until the next
    // manual tap. See the comment on useAppLock for the full reasoning.
    if (promptTick === 0 || !locked) return
    handleUnlock()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptTick])

  return (
    <>
      {children}
      {checked && locked && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Fingerprint className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">RouteLink is locked</p>
            <p className="text-sm text-muted-foreground">
              {isUnlocking ? "Waiting for fingerprint..." : failed ? "Authentication failed - try again" : "Unlock to continue"}
            </p>
          </div>
          <Button onClick={handleUnlock} disabled={isUnlocking}>
            {isUnlocking ? "Verifying..." : "Unlock"}
          </Button>
        </div>
      )}
    </>
  )
}
