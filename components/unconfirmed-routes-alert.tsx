"use client"

import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { AlertTriangle } from "lucide-react"

interface UnconfirmedRoute {
  id: number
  name: string
  dateLabel: string
}

interface UnconfirmedRoutesAlertProps {
  open: boolean
  routes: UnconfirmedRoute[]
  onDismiss: () => void
  onOpenCalendar: () => void
}

export function UnconfirmedRoutesAlert({ open, routes, onDismiss, onOpenCalendar }: UnconfirmedRoutesAlertProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onDismiss()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {routes.length} Unconfirmed Route{routes.length !== 1 ? "s" : ""}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 pt-2 text-left">
              <p>You have assigned routes that still need to be confirmed:</p>
              <ul className="space-y-1">
                {routes.map((r) => (
                  <li key={r.id} className="text-sm">
                    <span className="font-medium text-foreground">{r.name}</span> - {r.dateLabel}
                  </li>
                ))}
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-col gap-2">
          <AlertDialogAction onClick={onOpenCalendar} className="w-full">
            Review & Confirm Now
          </AlertDialogAction>
          <button onClick={onDismiss} className="text-sm text-muted-foreground hover:underline w-full text-center py-1">
            Remind me later
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
