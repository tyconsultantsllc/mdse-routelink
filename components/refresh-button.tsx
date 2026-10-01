"use client"

import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface RefreshButtonProps {
  onRefresh: () => void | Promise<void>
  refreshing: boolean
  className?: string
  label?: string
}

/**
 * The dedicated "force a refresh" button that sits next to pull-to-refresh
 * (components/pull-to-refresh.tsx) on every portal page - for anyone who'd
 * rather tap a button than drag, or is using the site in a plain desktop/
 * mobile browser where there's no drag gesture at all. Both call the exact
 * same page-level refresh handler, so they can never drift out of sync.
 */
export function RefreshButton({ onRefresh, refreshing, className, label = "Refresh" }: RefreshButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (!refreshing) onRefresh()
            }}
            disabled={refreshing}
            className={cn("h-9 w-9 md:h-10 md:w-10", className)}
            aria-label={label}
          >
            <RefreshCw className={cn("h-4 w-4 md:h-5 md:w-5", refreshing && "animate-spin")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
