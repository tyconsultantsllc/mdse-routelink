"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CameraOff } from 'lucide-react'

interface BarcodeScannerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (barcode: string) => void
  title?: string
  description?: string
  /**
   * When true, the dialog stays open and keeps scanning after a hit (used
   * for pharmacy packing, where several different packages get scanned one
   * after another). When false (default), it closes itself after the
   * first successful scan.
   */
  continuous?: boolean
}

export function BarcodeScannerDialog({
  open,
  onOpenChange,
  onScan,
  title = "Scan Barcode",
  description = "Point the camera at the package's barcode",
  continuous = false,
}: BarcodeScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const lastScan = useRef<{ code: string; at: number } | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [justScanned, setJustScanned] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setCameraError(null)

    const start = async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser")
        const reader = new BrowserMultiFormatReader()

        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
          if (cancelled || !result) return
          const code = result.getText()
          const now = Date.now()
          // Ignore the same code firing again within 2s - a barcode held
          // in view gets decoded many times a second otherwise.
          if (lastScan.current && lastScan.current.code === code && now - lastScan.current.at < 2000) {
            return
          }
          lastScan.current = { code, at: now }
          setJustScanned(code)
          onScan(code)
          if (!continuous) {
            controlsRef.current?.stop()
            onOpenChange(false)
          }
        })

        if (cancelled) {
          controls.stop()
          return
        }
        controlsRef.current = controls
      } catch (err: any) {
        if (!cancelled) {
          setCameraError(
            err?.name === "NotAllowedError"
              ? "Camera access was denied. Please allow camera access to scan barcodes."
              : "Could not access the camera on this device.",
          )
        }
      }
    }

    start()

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {cameraError ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CameraOff className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{cameraError}</p>
          </div>
        ) : (
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <div className="absolute inset-8 border-2 border-white/70 rounded-lg pointer-events-none" />
          </div>
        )}

        {continuous && justScanned && (
          <p className="text-sm text-center text-green-600">Scanned: {justScanned}</p>
        )}

        {continuous && (
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done Scanning
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
