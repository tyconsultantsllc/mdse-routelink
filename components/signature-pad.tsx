"use client"

import { useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react"
import { Button } from "@/components/ui/button"

export interface SignaturePadHandle {
  isEmpty: () => boolean
  toDataURL: () => string
  clear: () => void
}

interface SignaturePadProps {
  onChange?: (hasSignature: boolean) => void
}

/**
 * Signature capture built on the Pointer Events API so one set of handlers
 * covers mouse, touch, and stylus input (the original canvas only listened
 * for mouse events, which silently fails to draw on phones/tablets).
 *
 * Coordinates are rescaled from the canvas's rendered CSS size to its
 * internal pixel size, since the canvas is stretched with `w-full` — without
 * this, the drawn line drifts away from the finger/cursor on any screen
 * narrower than the canvas's intrinsic 500px width.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  { onChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const hasStrokeRef = useRef(false)
  const [, forceRender] = useState(0)

  const getPos = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }, [])

  const start = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.setPointerCapture(e.pointerId)
      drawingRef.current = true
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      const { x, y } = getPos(e)
      ctx.beginPath()
      ctx.moveTo(x, y)
    },
    [getPos],
  )

  const move = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      const { x, y } = getPos(e)
      ctx.lineTo(x, y)
      ctx.strokeStyle = "#111"
      ctx.lineWidth = 2.5
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.stroke()
      if (!hasStrokeRef.current) {
        hasStrokeRef.current = true
        onChange?.(true)
        forceRender((n) => n + 1)
      }
    },
    [getPos, onChange],
  )

  const end = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false
  }, [])

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    ctx?.clearRect(0, 0, canvas.width, canvas.height)
    hasStrokeRef.current = false
    onChange?.(false)
    forceRender((n) => n + 1)
  }, [onChange])

  useImperativeHandle(ref, () => ({
    isEmpty: () => !hasStrokeRef.current,
    toDataURL: () => canvasRef.current?.toDataURL("image/png") || "",
    clear,
  }))

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={500}
        height={200}
        style={{ touchAction: "none" }}
        className="border border-border rounded-md w-full cursor-crosshair bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
      />
      <Button type="button" variant="outline" size="sm" className="mt-2 bg-transparent" onClick={clear}>
        Clear Signature
      </Button>
    </div>
  )
})
