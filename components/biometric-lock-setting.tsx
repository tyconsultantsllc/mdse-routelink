"use client"

import { Fingerprint } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { useAppLock } from "@/lib/use-app-lock"

/**
 * "Unlock with fingerprint" toggle, meant to be dropped into each portal's
 * Settings dialog (driver, pharmacy, admin). Renders nothing outside the
 * native Android app or on a device with no biometry enrolled, since the
 * feature genuinely doesn't apply there - callers don't need to check
 * platform/availability themselves before rendering this.
 */
export function BiometricLockSetting() {
  const { checked, isNative, isAvailable, enabled, setEnabled } = useAppLock()
  const { toast } = useToast()

  if (!checked || !isNative || !isAvailable) return null

  const handleChange = async (value: boolean) => {
    await setEnabled(value)
    toast({
      title: value ? "Fingerprint unlock turned on" : "Fingerprint unlock turned off",
      description: value
        ? "You'll be asked to verify your fingerprint or face whenever you open or return to the app."
        : undefined,
    })
  }

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <Fingerprint className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
        <div>
          <Label htmlFor="biometric-lock" className="cursor-pointer">
            Unlock with fingerprint
          </Label>
          <p className="text-sm text-muted-foreground">
            Require your fingerprint or face to open the app or return to it from the background.
          </p>
        </div>
      </div>
      <Switch id="biometric-lock" checked={enabled} onCheckedChange={handleChange} />
    </div>
  )
}
