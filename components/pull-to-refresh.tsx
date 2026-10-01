"use client"

import type React from "react"
import { useCallback, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

// How far down (in px) a drag has to travel before letting go triggers a
// refresh - matches roughly what iOS/Android's own pull-to-refresh feels
// like. MAX_PULL caps how far the indicator/content can visually travel so
// a long, fast drag doesn't fling them off past a reasonable point.
const PULL_THRESHOLD = 70
const MAX_PULL = 110
// How far content sits translated down while a refresh is actually in
// flight (post-release), so the spinner has room to sit below the header
// instead of snapping back to 0 and disappearing mid-refresh.
const REFRESHING_OFFSET = 48

interface PullToRefreshProps {
  onRefresh: () => void | Promise<void>
  children: React.ReactNode
  className?: string
  // Most pages scroll their own wrapper div (the admin portal's shared
  // "flex-1 overflow-y-auto" content area) - that's "self", the default,
  // and this component both becomes that scrollable div and reads its own
  // scrollTop. The driver and pharmacy dashboards scroll the whole
  // document instead (no inner scroll container), so those pass "window"
  // and this component stays a plain, non-scrolling wrapper that reads
  // window.scrollY instead.
  scrollSource?: "self" | "window"
  // The element this renders as - "div" by default, or "main" for the one
  // page whose scroll container was already a <main> landmark, so swapping
  // in this component doesn't quietly drop that semantics.
  as?: "div" | "main"
}

/**
 * A drag-down-to-refresh gesture, for the native Android app only (it's
 * only wired up on pages already wrapped by Capacitor - nothing about this
 * component itself is native-only, but there's no reason to show it on the
 * plain website where a browser refresh already exists).
 *
 * Deliberately doesn't fight the platform: no preventDefault, no scroll
 * hijacking. It only starts tracking a drag when the scroll container is
 * already at its very top (so it can never interrupt normal scrolling
 * through a list), and purely layers a visual translateY + spinner on top
 * via CSS transforms - the real scroll position never moves because of
 * this component. `overscroll-behavior: contain` on the scrollable element
 * suppresses the platform's own overscroll glow so this is the only
 * feedback the person sees.
 */
export function PullToRefresh({ onRefresh, children, className, scrollSource = "self", as = "div" }: PullToRefreshProps) {
  // Cast to a plain ElementType: TS's JSX overload resolution for a
  // variable holding a "div" | "main" union otherwise tries to reconcile
  // both intrinsic elements' prop types at once (including the ref type),
  // which it can't do cleanly - this keeps the component polymorphic
  // without fighting that.
  const Container = as as React.ElementType
  const containerRef = useRef<HTMLElement>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startYRef = useRef<number | null>(null)
  const draggingRef = useRef(false)

  const isAtTop = useCallback(() => {
    if (scrollSource === "window") return window.scrollY <= 0
    return (containerRef.current?.scrollTop ?? 0) <= 0
  }, [scrollSource])

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (refreshing || !isAtTop()) return
      startYRef.current = e.touches[0].clientY
      draggingRef.current = true
    },
    [refreshing, isAtTop],
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!draggingRef.current || startYRef.current === null) return

      const delta = e.touches[0].clientY - startYRef.current
      if (delta <= 0 || !isAtTop()) {
        // Either not actually dragging downward, or scrolled away from the
        // top mid-gesture - stop treating this as a pull rather than show
        // a confusing partial indicator.
        draggingRef.current = false
        startYRef.current = null
        setPullDistance(0)
        return
      }

      // Resistance past the threshold, so it doesn't feel like the page
      // can be dragged off indefinitely.
      const eased = delta < PULL_THRESHOLD ? delta : PULL_THRESHOLD + (delta - PULL_THRESHOLD) * 0.3
      setPullDistance(Math.min(eased, MAX_PULL))
    },
    [isAtTop],
  )

  const finishDrag = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    startYRef.current = null

    if (pullDistance >= PULL_THRESHOLD) {
      setRefreshing(true)
      Promise.resolve(onRefresh()).finally(() => {
        setRefreshing(false)
        setPullDistance(0)
      })
    } else {
      setPullDistance(0)
    }
  }, [pullDistance, onRefresh])

  const visualOffset = refreshing ? REFRESHING_OFFSET : pullDistance
  const showIndicator = visualOffset > 0
  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1)

  return (
    <Container
      ref={containerRef as React.Ref<HTMLElement>}
      className={cn(scrollSource === "self" && "overflow-y-auto overscroll-y-contain", "relative", className)}
      style={scrollSource === "window" ? { overscrollBehaviorY: "contain" } : undefined}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={finishDrag}
      onTouchCancel={finishDrag}
    >
      {showIndicator && (
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex justify-center"
          style={{
            transform: `translateY(${visualOffset - 32}px)`,
            opacity: refreshing ? 1 : progress,
          }}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-card shadow-md">
            <RefreshCw
              className={cn("h-4 w-4 text-primary", refreshing && "animate-spin")}
              style={refreshing ? undefined : { transform: `rotate(${progress * 360}deg)` }}
            />
          </div>
        </div>
      )}
      <div
        style={{
          transform: visualOffset > 0 ? `translateY(${visualOffset}px)` : undefined,
          transition: draggingRef.current ? undefined : "transform 0.2s ease-out",
        }}
      >
        {children}
      </div>
    </Container>
  )
}
